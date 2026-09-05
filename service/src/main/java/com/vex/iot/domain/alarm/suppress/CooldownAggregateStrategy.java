package com.vex.iot.domain.alarm.suppress;

import com.vex.iot.domain.alarm.enums.AlarmAckStatus;
import com.vex.iot.domain.alarm.enums.AlarmLevel;
import com.vex.iot.domain.alarm.enums.EventStatus;
import com.vex.iot.common.util.IdGenerator;
import com.vex.iot.domain.alarm.AlarmService;
import com.vex.iot.domain.alarm.event.AlarmMessageFormatter;
import com.vex.iot.domain.alarm.model.AlarmLogEntity;
import com.vex.iot.domain.alarm.model.AlarmRuleEntity;
import com.vex.iot.domain.device.model.DataEntity;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Lazy;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.Optional;

/// 冷却聚合策略 - 冷却窗口内完全抑制，窗口外递增次数不通知
///
/// 逻辑：
/// 1. 首次告警 → 创建事件 + 发通知（triggerCount=1）
/// 2. 冷却窗口内（默认60s） → 完全抑制，不做任何操作
/// 3. 超过冷却窗口但未确认 → 递增 triggerCount，不发通知
///
/// 适用于：告警频繁抖动、需要减少通知噪音的场景
@Slf4j
@Component
@RequiredArgsConstructor
public class CooldownAggregateStrategy implements AlarmSuppressStrategy {

    /// 默认冷却窗口（秒）
    private static final int DEFAULT_COOLDOWN_SECONDS = 60;

    @Autowired
    @Lazy
    private AlarmService alarmService;

    @Override
    public AlarmSuppressType getType() {
        return AlarmSuppressType.COOLDOWN_AGGREGATE;
    }

    @Override
    public AlarmSuppressResult handle(AlarmRuleEntity rule, DataEntity data) {
        Instant now = data.getTimestamp();
        int cooldownSeconds = resolveCooldownSeconds(rule);

        // 查找该规则最新的活跃未确认告警事件
        Optional<AlarmLogEntity> existingEvent = alarmService
                .findActiveUnackById(
                        rule.getId());

        if (existingEvent.isPresent()) {
            AlarmLogEntity alarm = existingEvent.get();
            long elapsedSeconds = now.getEpochSecond() - alarm.getTriggeredAt().getEpochSecond();

            if (elapsedSeconds < cooldownSeconds) {
                // 冷却窗口内：完全抑制
                log.debug("策略COOLDOWN_AGGREGATE：规则[{}]在{}秒冷却窗口内，抑制重复报警",
                        rule.getId(), cooldownSeconds);
                return AlarmSuppressResult.suppressedResult();
            }

            // 超过冷却窗口但未确认：递增触发次数
            alarm.incrementTriggerCount();
            alarmService.saveLog(alarm);

            log.debug("策略COOLDOWN_AGGREGATE：规则[{}]告警聚合，触发次数+1", rule.getId());
            return AlarmSuppressResult.aggregated(alarm);
        }

        // 首次告警：创建事件 + 发通知
        AlarmLogEntity event = AlarmLogEntity.builder()
                .id(IdGenerator.snowId())
                .source(AlarmRuleEntity.AlarmRuleSource.POINT)
                .deviceId(rule.getDeviceId())
                .pointCode(rule.getPointCode())
                .ruleId(rule.getId())
                .level(rule.getLevel() == null ? AlarmLevel.WARNING : rule.getLevel())
                .triggerValue(data.getStringValue())
                .acknowledged(AlarmAckStatus.UNACK)
                .eventStatus(EventStatus.ACTIVE)
                .message(AlarmMessageFormatter.format(rule, data))
                .triggeredAt(now)
                .triggerCount(1)
                .build();

        alarmService.saveLog(event);
        log.debug("策略COOLDOWN_AGGREGATE：规则[{}]首次告警，创建事件[{}]", rule.getId(), event.getId());

        return AlarmSuppressResult.triggered(event);
    }

    /// 解析冷却时间（秒），优先使用规则配置，否则使用默认值
    private int resolveCooldownSeconds(AlarmRuleEntity rule) {
        // TODO: 后续可从 rule.getSuppressConfig() 读取自定义冷却时间
        return DEFAULT_COOLDOWN_SECONDS;
    }
}