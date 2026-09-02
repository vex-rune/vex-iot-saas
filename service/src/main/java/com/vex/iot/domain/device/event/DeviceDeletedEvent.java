package com.vex.iot.domain.device.event;

import com.vex.iot.common.util.IdGenerator;
import com.vex.iot.domain.event.IEvent;
import lombok.Data;

import java.time.LocalDateTime;

@Data
public final class DeviceDeletedEvent implements DeviceEvent<String> {

    public static final String CATEGORY = "device.deleted";

    private final IEvent.Metadata metadata;
    private final String payload;

    public DeviceDeletedEvent(String tenantId, String deviceId, String operatorId, LocalDateTime deletedAt) {
        this.metadata = new IEvent.Metadata(
                IdGenerator.snowId(),
                tenantId,
                DOMAIN_SOURCE,
                deletedAt == null ? LocalDateTime.now() : deletedAt,
                deviceId,
                null,
                CATEGORY
        );
        this.payload = deviceId;
    }
}