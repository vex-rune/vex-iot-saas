package com.vex.iot.domain.schedule;

import com.vex.iot.domain.schedule.model.DeviceScheduleEntity;
import com.vex.iot.domain.schedule.model.ScheduleAction;
import com.vex.iot.domain.schedule.repository.DeviceScheduleRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;

import java.util.List;

/**
 * 定时规则领域服务。
 * <p>
 * 负责规则的设置和触发判断，不包含业务逻辑。
 * </p>
 *
 * @author Vex
 * @since 1.0
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ScheduleRuleService {

    private final DeviceScheduleRepository scheduleRepository;
    private final ApplicationEventPublisher eventPublisher;

    // ==================== 规则查询 ====================

    /// 获取规则。
    public DeviceScheduleEntity getRule(String id) {
        return scheduleRepository.findById(id).orElse(null);
    }

    /// 查询设备下所有规则。
    public List<DeviceScheduleEntity> listRulesByDevice(String deviceId) {
        return scheduleRepository.findByDeviceId(deviceId);
    }

    /// 查询所有启用的规则。
    public List<DeviceScheduleEntity> listEnabledRules() {
        return scheduleRepository.findByEnabledTrue();
    }

    // ==================== 规则设置 ====================

    /// 保存规则。
    public DeviceScheduleEntity saveRule(DeviceScheduleEntity rule) {
        return scheduleRepository.save(rule);
    }

    /// 删除规则。
    public void deleteRule(String id) {
        scheduleRepository.deleteById(id);
    }

    /// 启用/禁用规则。
    public void setEnabled(String id, boolean enabled) {
        DeviceScheduleEntity rule = getRule(id);
        if (rule != null) {
            rule.setEnabled(enabled);
            scheduleRepository.save(rule);
        }
    }

    // ==================== 触发逻辑 ====================

    /// 发布规则触发事件。
    public void fire(String scheduleId) {
        DeviceScheduleEntity rule = getRule(scheduleId);
        if (rule == null || !Boolean.TRUE.equals(rule.getEnabled())) {
            log.debug("规则不存在或未启用，跳过触发 scheduleId={}", scheduleId);
            return;
        }

        List<ScheduleAction> actions = rule.getActions();
        if (actions == null || actions.isEmpty()) {
            log.debug("规则无动作，跳过触发 scheduleId={}", scheduleId);
            return;
        }

        // 发布领域事件
        eventPublisher.publishEvent(new ScheduleFiredEvent(
                this, scheduleId, rule.getDeviceId(), actions));

        log.info("规则触发 scheduleId={} deviceId={}", scheduleId, rule.getDeviceId());
    }
}
