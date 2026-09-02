package com.vex.iot.domain.schedule;

import com.vex.iot.common.util.IdGenerator;
import com.vex.iot.domain.event.IEvent;
import com.vex.iot.domain.schedule.model.ScheduleAction;
import lombok.Getter;

import java.time.LocalDateTime;
import java.util.List;

/**
 * 定时规则触发事件 — 实现 {@link IEvent}，由 BroadcastApp 统一采集。
 *
 * <p>由 {@code ScheduleRuleService} 发布，App 层监听并执行业务逻辑。
 * 改造点：原本继承 {@code ApplicationEvent} 是为了兼容老 Spring 事件机制，
 * 现在统一收敛到 {@link IEvent} 规范；{@code @EventListener} 对任意对象作为事件均生效。
 *
 * @author Vex
 * @since 1.0
 */
@Getter
public class ScheduleFiredEvent implements IEvent<List<ScheduleAction>> {

    public static final String CATEGORY = "schedule";
    public static final String SOURCE = "schedule-rule-service";

    /// 触发来源（保留原 ApplicationEvent#source 语义）
    private final Object source;

    /// 规则ID
    private final String scheduleId;

    /// 租户ID
    private final String tenantId;

    /// 设备ID
    private final String deviceId;

    /// 触发的动作列表
    private final List<ScheduleAction> actions;

    /// 事件发生时间
    private final LocalDateTime occurredAt;

    public ScheduleFiredEvent(Object source, String scheduleId, String deviceId,
                              List<ScheduleAction> actions) {
        this(source, scheduleId, null, deviceId, actions, LocalDateTime.now());
    }

    public ScheduleFiredEvent(Object source, String scheduleId, String tenantId, String deviceId,
                              List<ScheduleAction> actions, LocalDateTime occurredAt) {
        this.source = source;
        this.scheduleId = scheduleId;
        this.tenantId = tenantId;
        this.deviceId = deviceId;
        this.actions = actions;
        this.occurredAt = occurredAt;
    }

    // ==================== IEvent 实现 ====================

    @Override
    public Metadata getMetadata() {
        return new Metadata(
                scheduleId == null ? IdGenerator.snowId() : scheduleId,
                tenantId,
                SOURCE,
                occurredAt == null ? LocalDateTime.now() : occurredAt,
                deviceId,
                null,
                CATEGORY
        );
    }

    @Override
    public List<ScheduleAction> getPayload() {
        return actions;
    }

    @Override
    public String source() {
        return SOURCE;
    }
}
