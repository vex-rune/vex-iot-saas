package com.vex.iot.domain.schedule.event;

import com.vex.iot.common.util.IdGenerator;
import com.vex.iot.common.event.IEvent;
import com.vex.iot.domain.schedule.model.DeviceScheduleEntity;
import lombok.Data;

import java.time.Instant;

/**
 * 定时规则触发事件 — 由 {@code ScheduleRuleService} 的 10 秒扫描发布，
 * 由 {@code DeviceScheduleApp} 订阅并执行控制。
 */
@Data
public final class ScheduleFiredEvent implements IEvent<ScheduleFiredEvent.SchedulePayload> {

    public static final String CATEGORY = "schedule";
    public static final String SOURCE = "schedule-engine";

    private final IEvent.Metadata metadata;
    private final SchedulePayload payload;

    public ScheduleFiredEvent(DeviceScheduleEntity schedule, Instant fireTime) {
        this.metadata = new IEvent.Metadata(
                IdGenerator.snowId(),
                schedule.getTenantId(),
                SOURCE,
                fireTime,
                schedule.getDeviceId(),
                null,
                CATEGORY
        );
        this.payload = new SchedulePayload(schedule, fireTime);
    }

    /**
     * 事件载荷：触发的规则 + 触发时间。
     */
    public record SchedulePayload(
            DeviceScheduleEntity schedule,
            Instant fireTime
    ) {
    }
}