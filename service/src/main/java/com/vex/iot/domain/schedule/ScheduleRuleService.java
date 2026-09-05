package com.vex.iot.domain.schedule;

import com.vex.iot.common.exception.BadRequestException;
import com.vex.iot.common.model.TenantBaseEntity;
import com.vex.iot.common.util.IdGenerator;
import com.vex.iot.common.util.UserContext;
import com.vex.iot.domain.schedule.event.ScheduleFiredEvent;
import com.vex.iot.domain.schedule.exception.DeviceScheduleNotFoundException;
import com.vex.iot.domain.schedule.model.DeviceScheduleDetail;
import com.vex.iot.domain.schedule.model.DeviceScheduleEntity;
import com.vex.iot.domain.schedule.model.DeviceScheduleRequest;
import com.vex.iot.domain.schedule.model.PendingFire;
import com.vex.iot.domain.schedule.repository.DeviceScheduleRepository;
import com.vex.iot.domain.schedule.repository.PendingFireRepository;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.scheduling.support.CronExpression;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class ScheduleRuleService {

    private final DeviceScheduleRepository scheduleRepository;
    private final PendingFireRepository pendingFireRepository;
    private final ApplicationEventPublisher eventPublisher;

    @PostConstruct
    public void init() {
        log.info("[调度] 初始化, 开始首次预热...");
        preheat();
    }
    // ==================== CRUD ====================

    public List<DeviceScheduleDetail> listByDevice(String deviceId) {
        return scheduleRepository.findByDeviceId(deviceId).stream()
                .map(DeviceScheduleDetail::new).toList();
    }

    public DeviceScheduleDetail get(String id) {
        return new DeviceScheduleDetail(getRule(id));
    }

    @Transactional
    public DeviceScheduleDetail save(DeviceScheduleRequest req) {
        DeviceScheduleEntity incoming = req.schedule();
        validate(incoming);
        Instant now = Instant.now();
        String operator = UserContext.username().orElse(TenantBaseEntity.SYSTEM_USER_ID);

        if (isNew(incoming)) {
            incoming.setId(IdGenerator.snowId());
            if (incoming.getTenantId() == null || incoming.getTenantId().isBlank()) {
                incoming.setTenantId(TenantBaseEntity.DEFAULT_TENANT_ID);
            }
            incoming.stampCreated(operator, now);
        } else {
            DeviceScheduleEntity existed = getRule(incoming.getId());
            if (!existed.getDeviceId().equals(incoming.getDeviceId())) {
                throw new BadRequestException("不允许修改规则所属设备");
            }
            incoming.stampUpdated(operator, now);
            incoming.setCreateId(existed.getCreateId());
            incoming.setCreatedAt(existed.getCreatedAt());
            incoming.setTenantId(existed.getTenantId());
        }

        incoming.getActions().sort(Comparator.comparingInt(a -> a.getSortOrder() != null ? a.getSortOrder() : 0));
        DeviceScheduleEntity saved = scheduleRepository.save(incoming);
        log.info("保存定时规则 scheduleId={} enabled={}", saved.getId(), saved.getEnabled());
        return new DeviceScheduleDetail(saved);
    }

    public void deleteRule(String id) {
        getRule(id);
        scheduleRepository.deleteById(id);
        preheat();
    }

    public void setEnabled(String id, boolean enabled) {
        DeviceScheduleEntity rule = getRule(id);
        rule.setEnabled(enabled);
        scheduleRepository.save(rule);
        log.info("设置定时规则启用状态 scheduleId={} enabled={}", id, enabled);
        preheat();
    }

    public DeviceScheduleEntity getRule(String id) {
        return scheduleRepository.findById(id)
                .orElseThrow(() -> new DeviceScheduleNotFoundException(id));
    }

    public DeviceScheduleEntity saveRule(DeviceScheduleEntity rule) {
        DeviceScheduleEntity save = scheduleRepository.save(rule);
        preheat();
        return save;
    }

    // ==================== 调度引擎 ====================

    @Scheduled(fixedRate = 3_600_000, initialDelay = 0)
    public void preheat() {
        try {
            doPreheat();
        } catch (Exception e) {
            log.error("[调度预热] 异常, 保留旧待办 {} 条, 等下次重试", pendingFireRepository.size(), e);
        }
    }

    @Scheduled(fixedRate = 10_000)
    public void scan() {
        try {
            doScan();
        } catch (Exception e) {
            log.error("[调度扫描] 未预期异常, 等下次周期重试", e);
        }
    }

    // ==================== 内部方法 ====================

    private void doPreheat() {
        Instant now = Instant.now();
        Instant window = now.plusSeconds(65 * 60);
        List<DeviceScheduleEntity> rules = scheduleRepository.findByEnabledTrue();
        log.info("[调度预热] 加载启用规则 {} 条, 窗口 {} ~ {}", rules.size(), now, window);

        List<PendingFire> newPending = new ArrayList<>();
        int skipped = 0;
        for (DeviceScheduleEntity rule : rules) {
            if (rule.getCron() == null || rule.getCron().isBlank()) {
                skipped++;
                continue;
            }
            try {
                CronExpressionHelper.getNextFireTimes(rule.getCron(), now, window)
                        .forEach(ft -> newPending.add(new PendingFire(ft, rule)));
            } catch (Exception e) {
                skipped++;
                log.warn("[调度预热] cron 解析失败, 跳过 scheduleId={} cron={}", rule.getId(), rule.getCron(), e);
            }
        }
        newPending.sort(Comparator.comparing(PendingFire::fireTime));
        pendingFireRepository.replaceAll(newPending);
        log.info("[调度预热] 完成, 待办 {} 条, 跳过 {} 条", newPending.size(), skipped);
    }

    private void doScan() {
        if (pendingFireRepository.isEmpty()) return;
        Instant now = Instant.now();
        List<PendingFire> fired = pendingFireRepository.findAll().stream()
                .filter(p -> !p.fireTime().isAfter(now)).toList();
        if (fired.isEmpty()) return;

        pendingFireRepository.remove(fired);
        int success = 0, fail = 0;
        for (PendingFire pf : fired) {
            try {
                log.info("[调度触发] scheduleId={} deviceId={} fireTime={}",
                        pf.schedule().getId(), pf.schedule().getDeviceId(), pf.fireTime());
                eventPublisher.publishEvent(new ScheduleFiredEvent(pf.schedule(), pf.fireTime()));
                success++;
            } catch (Exception e) {
                fail++;
                log.error("[调度触发] 发布事件失败 scheduleId={}", pf.schedule().getId(), e);
            }
        }
        if (fail > 0) log.warn("[调度触发] 本轮完成: 成功 {} 条, 失败 {} 条", success, fail);
    }

    private void validate(DeviceScheduleEntity s) {
        if (s.getDeviceId() == null || s.getDeviceId().isBlank()) throw new BadRequestException("设备ID不能为空");
        if (s.getCron() == null || s.getCron().isBlank()) throw new BadRequestException("Cron 表达式不能为空");
        try {
            CronExpression.parse(s.getCron());
        } catch (Exception ex) {
            throw new BadRequestException("Cron 表达式不合法: " + ex.getMessage());
        }
    }

    private static boolean isNew(DeviceScheduleEntity s) {
        return s.getId() == null || s.getId().isBlank();
    }
}