package com.vex.iot.domain.alarm.suppress;

import com.vex.iot.domain.alarm.enums.AlarmAckStatus;
import com.vex.iot.domain.alarm.enums.AlarmLevel;
import com.vex.iot.domain.alarm.enums.EventStatus;
import com.vex.iot.common.util.IdGenerator;
import com.vex.iot.domain.alarm.AlarmService;
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

/// 滑动窗口策略 - 固定时间窗口内只通知一次，窗口结束后重置
///
/// 逻辑：
/// 1. 首次告警 → 创建事件 + 发通知，记录窗口开始时间
/// 2. 窗口内重复触发 → 完全抑制
/// 3. 窗口结束后再次触发 → 创建新事件 + 发通知（重置窗口）
///
/// 与 COOLDOWN_AGGREGATE 的区别：窗口结束后创建新事件而非递增次数
///
/// 适用于：需要按固定周期汇总告警、窗口结束后重新通知的场景
@Slf4j
@Component
@RequiredArgsConstructor
public class SlidingWindowStrategy implements AlarmSuppressStrategy {

    @Autowired
    @Lazy
    private   AlarmService alarmService;

    /// 默认窗口大小（秒）
    private static final int DEFAULT_WINDOW_SECONDS = 300; // 5分钟

    @Override
    public AlarmSuppressType getType() {
        return AlarmSuppressType.SLIDING_WINDOW;
    }

    @Override
    public AlarmSuppressResult handle(AlarmRuleEntity rule, DataEntity data) {
        Instant now = data.getTimestamp();
        int windowSeconds = resolveWindowSeconds(rule);

        // 查找该规则最新的活跃未确认告警事件
        Optional<AlarmLogEntity> existingEvent = alarmService.findActiveUnackById(rule.getId());

        if (existingEvent.isPresent()) {
            AlarmLogEntity alarm = existingEvent.get();
            long elapsedSeconds = now.getEpochSecond() - alarm.getTriggeredAt().getEpochSecond();

            if (elapsedSeconds < windowSeconds) {
                // 窗口内：完全抑制
                log.debug("策略SLIDING_WINDOW：规则[{}]在{}秒窗口内，抑制重复报警",
                        rule.getId(), windowSeconds);
                return AlarmSuppressResult.suppressedResult();
            }

            // 窗口结束：创建新事件（重置窗口）
            log.debug("策略SLIDING_WINDOW：规则[{}]窗口结束，创建新告警事件", rule.getId());
        }

        // 首次告警或窗口结束后：创建新事件 + 发通知
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
                .triggeredAt(now)
                .triggerCount(1)
                .build();

        alarmService.saveLog(event);
        log.debug("策略SLIDING_WINDOW：规则[{}]创建告警事件[{}]", rule.getId(), event.getId());

        return AlarmSuppressResult.triggered(event);
    }

    /// 解析窗口大小（秒），优先使用规则配置，否则使用默认值
    private int resolveWindowSeconds(AlarmRuleEntity rule) {
        // TODO: 后续可从 rule.getSuppressConfig() 读取自定义窗口大小
        return DEFAULT_WINDOW_SECONDS;
    }
}