package com.vex.iot.domain.device.event;

import com.vex.iot.common.util.IdGenerator;
import com.vex.iot.domain.device.model.DeviceEntity;
import com.vex.iot.domain.event.IEvent;
import lombok.Data;

import java.time.Instant;

@Data
public final class DeviceUpdatedEvent implements DeviceEvent<DeviceEntity> {

    public static final String CATEGORY = "device.updated";

    private final IEvent.Metadata metadata;
    private final DeviceEntity payload;

    public DeviceUpdatedEvent(DeviceEntity device) {
        this.metadata = new IEvent.Metadata(
                IdGenerator.snowId(),
                device == null ? null : device.getTenantId(),
                DOMAIN_SOURCE,
                Instant.now(),
                device == null ? null : device.getId(),
                null,
                CATEGORY
        );
        this.payload = device;
    }
}