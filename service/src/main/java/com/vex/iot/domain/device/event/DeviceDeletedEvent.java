package com.vex.iot.domain.device.event;

import com.vex.iot.common.util.IdGenerator;
import com.vex.iot.domain.device.model.DeviceEntity;
import com.vex.iot.common.event.IEvent;
import lombok.Data;

import java.time.Instant;

@Data
public final class DeviceDeletedEvent implements DeviceEvent<DeviceEntity> {

    public static final String CATEGORY = "device.deleted";

    private final IEvent.Metadata metadata;
    private final DeviceEntity payload;

    public DeviceDeletedEvent(DeviceEntity saved) {
        this.metadata = new IEvent.Metadata(
                IdGenerator.snowId(),
                saved.getTenantId(),
                DOMAIN_SOURCE,
                Instant.now(),
                saved.getId(),
                null,
                CATEGORY
        );
        this.payload = saved;
    }
}