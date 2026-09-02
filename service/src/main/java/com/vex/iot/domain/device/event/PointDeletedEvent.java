package com.vex.iot.domain.device.event;

import com.vex.iot.common.util.IdGenerator;
import com.vex.iot.domain.event.IEvent;
import lombok.Data;

import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.Map;

@Data
public final class PointDeletedEvent implements DeviceEvent<Map<String, Object>> {

    public static final String CATEGORY = "point.deleted";

    private final IEvent.Metadata metadata;
    private final Map<String, Object> payload;

    public PointDeletedEvent(String tenantId, String deviceId, String pointId,
                             String operatorId, LocalDateTime deletedAt) {
        this.metadata = new IEvent.Metadata(
                IdGenerator.snowId(),
                tenantId,
                DOMAIN_SOURCE,
                deletedAt == null ? LocalDateTime.now() : deletedAt,
                deviceId,
                null,
                CATEGORY
        );
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("deviceId", deviceId);
        m.put("pointId", pointId);
        m.put("operatorId", operatorId);
        m.put("deletedAt", deletedAt);
        this.payload = m;
    }
}