package com.vex.iot.domain.device.event;

import com.vex.iot.common.util.IdGenerator;
import com.vex.iot.domain.device.model.PointEntity;
import com.vex.iot.domain.event.IEvent;
import lombok.Data;

import java.time.LocalDateTime;

@Data
public final class PointCreatedEvent implements DeviceEvent<PointEntity> {

    public static final String CATEGORY = "point.created";

    private final IEvent.Metadata metadata;
    private final PointEntity payload;

    public PointCreatedEvent(PointEntity point) {
        this.metadata = new IEvent.Metadata(
                IdGenerator.snowId(),
                point == null ? null : point.getTenantId(),
                DOMAIN_SOURCE,
                LocalDateTime.now(),
                point == null ? null : point.getDeviceId(),
                point == null ? null : point.getPointCode(),
                CATEGORY
        );
        this.payload = point;
    }
}