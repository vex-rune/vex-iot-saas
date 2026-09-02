package com.vex.iot.domain.device.event;

import com.vex.iot.common.util.IdGenerator;
import com.vex.iot.domain.device.model.DeviceEntity;
import com.vex.iot.domain.event.IEvent;
import lombok.Data;

import java.time.LocalDateTime;

@Data
public final class DeviceHeartbeatEvent implements DeviceEvent<DeviceEntity> {

    public static final String CATEGORY = "device.online.heartbeat";

    private final IEvent.Metadata metadata;
    private final DeviceEntity payload;


    public DeviceHeartbeatEvent(DeviceEntity device) {
        this.metadata = new IEvent.Metadata(
                IdGenerator.snowId(),
                device.getTenantId(),
                DOMAIN_SOURCE,
                device.getLastHeartbeatAt(),
                device.getId(),
                null,
                CATEGORY
        );
        this.payload = device;
    }
}