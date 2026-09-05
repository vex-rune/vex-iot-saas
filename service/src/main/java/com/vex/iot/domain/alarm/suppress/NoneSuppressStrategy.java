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

/// 不抑制策略 - 每次触发都生成新告警事件并通知
///
/// 适用于：需要完整记录每次告警触发的场景
@Slf4j
@Component
@RequiredArgsConstructor
public class NoneSuppressStrategy implements AlarmSuppressStrategy {

    @Autowired
    @Lazy
    private   AlarmService alarmService;
    @Override
    public AlarmSuppressType getType() {
        return AlarmSuppressType.NONE;
    }

    @Override
    public AlarmSuppressResult handle(AlarmRuleEntity rule, DataEntity data ) {
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
                .triggeredAt(data.getTimestamp())
                .triggerCount(1)
                .build();

        alarmService.saveLog(event);
        log.debug("策略NONE：规则[{}]创建新告警事件[{}]", rule.getId(), event.getId());

        return AlarmSuppressResult.triggered(event);
    }
}