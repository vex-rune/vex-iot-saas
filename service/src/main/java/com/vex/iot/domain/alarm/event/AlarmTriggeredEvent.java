package com.vex.iot.domain.alarm.event;

import com.vex.iot.common.util.IdGenerator;
import com.vex.iot.domain.alarm.model.AlarmRuleEntity;
import com.vex.iot.domain.data.model.DataEntity;
import com.vex.iot.domain.event.IEvent;
import lombok.Data;

import java.time.Instant;

/// 报警触发事件 — 实现 {@link IEvent}。兼容旧 API：业务字段直接暴露 getter。
@Data
public final class AlarmTriggeredEvent implements IEvent<AlarmTriggeredEvent.AlarmMessage> {

    public static final String CATEGORY = "alarm";
    public static final String SOURCE = "alarm-engine";

    private final IEvent.Metadata metadata;
    private final AlarmMessage payload;

    public AlarmTriggeredEvent(
            AlarmRuleEntity rule,
            DataEntity data,
            String message
    ) {
        this.metadata = new IEvent.Metadata(
                IdGenerator.snowId(),
                rule.getTenantId(),
                SOURCE,
                Instant.now(),
                data.getDeviceId(),
                data.getPointId(),
                CATEGORY
        );

        this.payload = new AlarmMessage(rule, data, message);
    }

    public record AlarmMessage(
            AlarmRuleEntity rule,
            DataEntity data,
            String message
    ) {
    }
}