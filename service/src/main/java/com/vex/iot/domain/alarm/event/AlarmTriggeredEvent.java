package com.vex.iot.domain.alarm.event;

import com.vex.iot.common.enums.AlarmLevel;
import com.vex.iot.common.model.CurrentUser;
import com.vex.iot.common.util.IdGenerator;
import com.vex.iot.domain.event.IEvent;
import lombok.Data;

import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/// 报警触发事件 — 实现 {@link IEvent}。兼容旧 API：业务字段直接暴露 getter。
@Data
public final class AlarmTriggeredEvent implements IEvent<Map<String, Object>> {

    public static final String CATEGORY = "alarm";

    // ==================== IEvent 标准字段 ====================

    private final IEvent.Metadata metadata;
    private final Map<String, Object> payload;

    // ==================== 兼容旧业务 getter 的字段 ====================

    private final AlarmLevel level;
    private final String message;
    private final List<String> notifyUserIds;
    private final CurrentUser triggerUser;
    private final String tenantId;
    private final String deviceId;
    private final String pointCode;
    private final String eventId;

    public AlarmTriggeredEvent(String tenantId, String deviceId, String pointCode,
                               AlarmLevel level, String message, List<String> notifyUserIds,
                               CurrentUser triggerUser) {
        String eid = IdGenerator.snowId();
        this.eventId = eid;
        this.tenantId = tenantId;
        this.deviceId = deviceId;
        this.pointCode = pointCode;
        this.level = level;
        this.message = message;
        this.notifyUserIds = notifyUserIds;
        this.triggerUser = triggerUser;

        this.metadata = new IEvent.Metadata(
                eid, tenantId, "alarm-engine", LocalDateTime.now(),
                deviceId, pointCode, CATEGORY
        );

        Map<String, Object> data = new LinkedHashMap<>();
        data.put("eventId", eid);
        data.put("deviceId", deviceId);
        data.put("pointCode", pointCode);
        data.put("level", level == null ? null : level.name());
        data.put("message", message);
        data.put("notifyUserIds", notifyUserIds);
        if (triggerUser != null) {
            data.put("triggerUserId", triggerUser.userId());
            data.put("triggerUsername", triggerUser.username());
        }
        data.put("occurredAt", LocalDateTime.now());
        this.payload = data;
    }
}