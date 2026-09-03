package com.vex.iot.domain.device.event;

import com.vex.iot.common.util.IdGenerator;
import com.vex.iot.domain.device.model.PointEntity;
import com.vex.iot.domain.event.IEvent;
import lombok.Data;

import java.time.Instant;

@Data
public final class PointDeletedEvent implements DeviceEvent<PointEntity> {

    public static final String CATEGORY = "point.deleted";

    private final IEvent.Metadata metadata;
    private final PointEntity payload;


    public PointDeletedEvent(PointEntity exist) {
        this.metadata = new IEvent.Metadata(
                IdGenerator.snowId(),
                exist.getTenantId(),
                DOMAIN_SOURCE,
                Instant.now(),
                exist.getDeviceId(),
                null,
                CATEGORY
        );
        this.payload = exist;
    }
}