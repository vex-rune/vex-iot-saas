package com.vex.iot.domain.schedule;

import com.vex.iot.common.exception.BusinessExceptions.BadRequestException;
import com.vex.iot.common.model.BaseEntity;
import com.vex.iot.common.util.IdGenerator;
import com.vex.iot.common.util.UserContext;
import com.vex.iot.domain.schedule.model.DeviceScheduleDetail;
import com.vex.iot.domain.schedule.model.DeviceScheduleEntity;
import com.vex.iot.domain.schedule.model.DeviceScheduleRequest;
import com.vex.iot.domain.schedule.exception.DeviceScheduleNotFoundException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.event.EventListener;
import org.springframework.scheduling.support.CronExpression;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.Comparator;
import java.util.List;

/**
 * 设备定时控制应用服务。
 * <p>
 * 负责业务校验、持久化、事件监听。规则触发由 Domain 层 ScheduleRuleService 发布事件。
 * </p>
 *
 * @author Vex
 * @since 1.0
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class DeviceScheduleService {

    private final ScheduleRuleService ruleService;

    // ==================== 查询 ====================

    /// 查询设备下所有定时规则。
    public List<DeviceScheduleDetail> listByDevice(String deviceId) {
        return ruleService.listRulesByDevice(deviceId).stream()
                .map(DeviceScheduleDetail::new)
                .toList();
    }

    /// 查询单条规则详情。
    public DeviceScheduleDetail get(String id) {
        DeviceScheduleEntity rule = ruleService.getRule(id);
        if (rule == null) {
            throw new DeviceScheduleNotFoundException(id);
        }
        return new DeviceScheduleDetail(rule);
    }

    // ==================== 保存 ====================

    /// 保存定时规则（含动作）。
    @Transactional
    public DeviceScheduleDetail save(DeviceScheduleRequest req) {
        DeviceScheduleEntity incoming = req.schedule();
        validate(incoming);

        LocalDateTime now = LocalDateTime.now();
        String operator = UserContext.username().orElse(BaseEntity.SYSTEM_USER_ID);
        String ruleId;

        if (incoming.getId() == null || incoming.getId().isBlank()) {
            // 新增
            ruleId = IdGenerator.snowId();
            incoming.setId(ruleId);
            if (incoming.getTenantId() == null || incoming.getTenantId().isBlank()) {
                incoming.setTenantId(BaseEntity.DEFAULT_TENANT_ID);
            }
            incoming.stampCreated(operator, now);
        } else {
            // 更新
            ruleId = incoming.getId();
            DeviceScheduleEntity existed = ruleService.getRule(ruleId);
            if (existed == null) {
                throw new DeviceScheduleNotFoundException(ruleId);
            }
            if (!existed.getDeviceId().equals(incoming.getDeviceId())) {
                throw new BadRequestException("不允许修改规则所属设备");
            }
            incoming.stampUpdated(operator, now);
            incoming.setCreateId(existed.getCreateId());
            incoming.setCreatedAt(existed.getCreatedAt());
            incoming.setTenantId(existed.getTenantId());
        }

        // 设置 actions 并按 sortOrder 排序
        incoming.getActions().sort(Comparator.comparingInt(a -> a.getSortOrder() != null ? a.getSortOrder() : 0));

        // 保存（actions 随实体一起存储为 JSON）
        DeviceScheduleEntity saved = ruleService.saveRule(incoming);
        log.info("保存定时规则完成 scheduleId={} enabled={}", saved.getId(), saved.getEnabled());

        // TODO: 通知调度器刷新任务队列

        return new DeviceScheduleDetail(saved);
    }

    // ==================== 删除 ====================

    /// 删除定时规则。
    @Transactional
    public void delete(String id) {
        ruleService.getRule(id); // 校验存在
        ruleService.deleteRule(id);
        log.info("删除定时规则 scheduleId={}", id);

        // TODO: 通知调度器刷新任务队列
    }

    // ==================== 启停 ====================

    /// 启用/禁用规则。
    @Transactional
    public void setEnabled(String id, boolean enabled) {
        DeviceScheduleEntity rule = ruleService.getRule(id);
        if (rule == null) {
            throw new DeviceScheduleNotFoundException(id);
        }
        ruleService.setEnabled(id, enabled);
        log.info("设置定时规则启用状态 scheduleId={} enabled={}", id, enabled);

        // TODO: 通知调度器刷新任务队列
    }

    // ==================== 事件监听 ====================

    /// 监听规则触发事件，执行写操作。
    @EventListener
    public void onScheduleFired(ScheduleFiredEvent event) {
        log.info("收到定时触发事件 scheduleId={} deviceId={}", event.getScheduleId(), event.getDeviceId());

        // TODO: 调用设备下行接口，写入点位值
        // 1. 按 sortOrder 排序动作（已排序）
        // 2. 逐个调用下行接口
        // 3. 更新 lastFireAt
    }

    // ==================== 内部方法 ====================

    private void validate(DeviceScheduleEntity s) {
        if (s.getDeviceId() == null || s.getDeviceId().isBlank()) {
            throw new BadRequestException("设备ID不能为空");
        }
        if (s.getCron() == null || s.getCron().isBlank()) {
            throw new BadRequestException("Cron 表达式不能为空");
        }
        try {
            CronExpression.parse(s.getCron());
        } catch (Exception ex) {
            throw new BadRequestException("Cron 表达式不合法: " + ex.getMessage());
        }
    }
}
