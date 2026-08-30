package com.vex.iot.domain.schedule;

import com.vex.iot.domain.pdata.PointControlServer;
import com.vex.iot.domain.schedule.model.DeviceScheduleActionEntity;
import com.vex.iot.domain.schedule.model.DeviceScheduleEntity;
import com.vex.iot.domain.schedule.repository.DeviceScheduleActionRepository;
import com.vex.iot.domain.schedule.repository.DeviceScheduleRepository;
import jakarta.annotation.PreDestroy;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicBoolean;

/**
 * 设备定时控制 - 内存队列调度器
 * <p>实现思路：
 * <ol>
 *   <li>每小时扫描数据库，获取所有启用的规则</li>
 *   <li>根据 Cron 表达式计算未来1天内的所有执行时间点</li>
 *   <li>放入优先队列（按执行时间排序）</li>
 *   <li>执行循环不断检查队首任务，到期则执行</li>
 * </ol>
 */
@Slf4j
@Service
public class DeviceScheduleScheduler {

    private final DeviceScheduleRepository scheduleRepository;
    private final DeviceScheduleActionRepository actionRepository;
    private final PointControlServer pointControlServer;

    /** 任务执行时间优先队列 */
    private final PriorityQueue<ScheduledTask> taskQueue = new PriorityQueue<>(
            Comparator.comparing(ScheduledTask::fireTime)
    );

    /** 正在刷新中标记，防止重复刷新 */
    private final AtomicBoolean refreshing = new AtomicBoolean(false);

    /** 已加载的规则ID集合，用于检测新增/删除 */
    private final Set<String> loadedRuleIds = ConcurrentHashMap.newKeySet();

    /** 执行线程 */
    private volatile boolean running = true;
    private final Thread executorThread;

    /** 任务队列锁 */
    private final Object lock = new Object();

    public DeviceScheduleScheduler(
            DeviceScheduleRepository scheduleRepository,
            DeviceScheduleActionRepository actionRepository,
            PointControlServer pointControlServer) {
        this.scheduleRepository = scheduleRepository;
        this.actionRepository = actionRepository;
        this.pointControlServer = pointControlServer;
        this.executorThread = new Thread(this::executorLoop, "device-schedule-executor");
    }

    @PreDestroy
    public void stop() {
        running = false;
        executorThread.interrupt();
    }

    /**
     * 应用启动后开始执行循环
     */
    @EventListener(ApplicationReadyEvent.class)
    public void start() {
        // 先加载一次任务
        refreshTasks();
        // 启动执行循环
        executorThread.setDaemon(true);
        executorThread.start();
        log.info("设备定时控制调度器已启动");
    }

    /**
     * 每小时扫描一次数据库，刷新任务队列
     * <p>更严谨的实现：
     * <ul>
     *   <li>防止并发重复刷新</li>
     *   <li>增量更新（只处理新增/删除的规则）</li>
     * </ul>
     */
    @Scheduled(fixedRate = 60 * 60 * 1000)
    public void refreshTasks() {
        if (!refreshing.compareAndSet(false, true)) {
            log.debug("任务队列正在刷新中，跳过本次刷新");
            return;
        }
        try {
            doRefresh(false);
        } finally {
            refreshing.set(false);
        }
    }

    /**
     * 手动刷新任务队列
     * <p>当保存/删除/启用禁用规则时，调用此方法立即更新队列
     *
     * @param ruleId 要刷新的规则ID（可选，为null时刷新全部）
     */
    public void refreshTasks(String ruleId) {
        if (!refreshing.compareAndSet(false, true)) {
            log.debug("任务队列正在刷新中，将在下一次刷新时更新 ruleId={}", ruleId);
            return;
        }
        try {
            if (ruleId != null) {
                // 单个规则刷新
                doRefreshRule(ruleId);
            } else {
                doRefresh(true);
            }
        } finally {
            refreshing.set(false);
        }
    }

    /**
     * 全量刷新任务队列
     */
    private void doRefresh(boolean forceAll) {
        log.info("开始刷新定时任务队列...");
        try {
            List<DeviceScheduleEntity> rules = scheduleRepository.findByEnabledTrue();
            Set<String> currentRuleIds = new HashSet<>();
            LocalDateTime now = LocalDateTime.now();
            LocalDateTime endTime = now.plusDays(1);

            List<ScheduledTask> newTasks = new ArrayList<>();

            for (DeviceScheduleEntity rule : rules) {
                currentRuleIds.add(rule.getId());
                try {
                    // 增量模式：只有规则不在已加载集合中时才添加
                    if (!forceAll && loadedRuleIds.contains(rule.getId())) {
                        continue;
                    }
                    List<LocalDateTime> fireTimes = CronExpressionHelper.getNextFireTimes(rule.getCron(), now, endTime);
                    for (LocalDateTime fireTime : fireTimes) {
                        newTasks.add(new ScheduledTask(rule.getId(), rule.getDeviceId(), rule.getTenantId(), fireTime));
                    }
                } catch (Exception ex) {
                    log.warn("计算定时任务执行时间失败 ruleId={} cron={} err={}",
                            rule.getId(), rule.getCron(), ex.getMessage());
                }
            }

            // 检测删除的规则
            Set<String> removedRuleIds = new HashSet<>(loadedRuleIds);
            removedRuleIds.removeAll(currentRuleIds);

            // 加锁更新队列
            synchronized (lock) {
                // 移除已删除规则的任务
                if (!removedRuleIds.isEmpty()) {
                    taskQueue.removeIf(task -> removedRuleIds.contains(task.scheduleId()));
                    log.info("移除已删除规则的任务 ruleIds={}", removedRuleIds);
                }

                // 添加新任务
                if (!newTasks.isEmpty()) {
                    taskQueue.addAll(newTasks);
                }

                // 更新已加载规则集合
                loadedRuleIds.clear();
                loadedRuleIds.addAll(currentRuleIds);
            }

            log.info("定时任务队列刷新完成, 当前队列任务数={}, 已加载规则数={}", taskQueue.size(), loadedRuleIds.size());
        } catch (Exception ex) {
            log.error("刷新定时任务队列失败", ex);
        }
    }

    /**
     * 刷新单个规则
     */
    private void doRefreshRule(String ruleId) {
        synchronized (lock) {
            // 移除该规则现有的任务
            taskQueue.removeIf(task -> task.scheduleId().equals(ruleId));
        }

        // 重新加载该规则
        DeviceScheduleEntity rule = scheduleRepository.findById(ruleId).orElse(null);
        if (rule == null || !Boolean.TRUE.equals(rule.getEnabled())) {
            loadedRuleIds.remove(ruleId);
            log.info("规则已删除或禁用，已从队列中移除 ruleId={}", ruleId);
            return;
        }

        LocalDateTime now = LocalDateTime.now();
        LocalDateTime endTime = now.plusDays(1);
        try {
            List<LocalDateTime> fireTimes = CronExpressionHelper.getNextFireTimes(rule.getCron(), now, endTime);
            List<ScheduledTask> newTasks = new ArrayList<>();
            for (LocalDateTime fireTime : fireTimes) {
                newTasks.add(new ScheduledTask(rule.getId(), rule.getDeviceId(), rule.getTenantId(), fireTime));
            }

            synchronized (lock) {
                taskQueue.addAll(newTasks);
                loadedRuleIds.add(ruleId);
            }

            log.info("规则任务刷新完成 ruleId={}, 新增任务数={}", ruleId, newTasks.size());
        } catch (Exception ex) {
            log.warn("刷新规则任务失败 ruleId={} err={}", ruleId, ex.getMessage());
        }
    }

    /**
     * 执行循环：不断检查队首任务，到期则执行
     */
    private void executorLoop() {
        while (running) {
            try {
                ScheduledTask task;
                synchronized (lock) {
                    task = taskQueue.peek();
                }

                if (task == null) {
                    // 没有任务，短暂休眠
                    Thread.sleep(1000);
                    continue;
                }

                LocalDateTime now = LocalDateTime.now();
                if (task.fireTime().isAfter(now)) {
                    // 任务还未到执行时间，计算等待时间
                    long waitMs = Duration.between(now, task.fireTime()).toMillis();
                    if (waitMs > 0) {
                        Thread.sleep(Math.min(waitMs, 5000)); // 最多等待5秒
                    }
                    continue;
                }

                // 执行任务
                synchronized (lock) {
                    taskQueue.poll(); // 取出任务
                }
                executeTask(task);

            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                break;
            } catch (Exception ex) {
                log.error("执行定时任务异常", ex);
                try {
                    Thread.sleep(1000);
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                    break;
                }
            }
        }
    }

    /**
     * 执行单个定时任务
     */
    private void executeTask(ScheduledTask task) {
        log.info("开始执行定时任务 scheduleId={} deviceId={} fireTime={}",
                task.scheduleId(), task.deviceId(), task.fireTime());

        DeviceScheduleEntity rule = scheduleRepository.findById(task.scheduleId()).orElse(null);
        if (rule == null || Boolean.FALSE.equals(rule.getEnabled())) {
            log.info("定时规则不存在或已禁用, 跳过 scheduleId={}", task.scheduleId());
            return;
        }

        List<DeviceScheduleActionEntity> actions = actionRepository.findByScheduleIdOrderBySortOrderAsc(task.scheduleId());
        if (actions.isEmpty()) {
            log.info("定时规则无动作, scheduleId={}", task.scheduleId());
            return;
        }

        int success = 0, fail = 0;
        for (DeviceScheduleActionEntity action : actions) {
            try {
                Object typedValue = castValue(action.getValueText());
                pointControlServer.control(task.deviceId(), action.getPointCode(), typedValue, task.tenantId());
                success++;
            } catch (Exception ex) {
                fail++;
                log.warn("定时下发失败 scheduleId={} pointCode={} value={} err={}",
                        task.scheduleId(), action.getPointCode(), action.getValueText(), ex.getMessage());
            }
        }

        // 更新最后执行时间
        rule.setLastFireAt(LocalDateTime.now());
        scheduleRepository.save(rule);

        log.info("定时控制完成 scheduleId={} success={} fail={}", task.scheduleId(), success, fail);
    }

    private Object castValue(String raw) {
        if (raw == null) return "";
        String t = raw.trim();
        if (t.equalsIgnoreCase("true") || t.equalsIgnoreCase("false")) {
            return Boolean.parseBoolean(t);
        }
        try {
            return Long.parseLong(t);
        } catch (NumberFormatException ignore) {
            // 继续尝试 Double
        }
        try {
            return Double.parseDouble(t);
        } catch (NumberFormatException ignore) {
            // 保持字符串
        }
        return raw;
    }

    /**
     * 待执行任务封装
     */
    private record ScheduledTask(
            String scheduleId,
            String deviceId,
            String tenantId,
            LocalDateTime fireTime
    ) {}
}
