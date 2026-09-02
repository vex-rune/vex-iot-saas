package com.vex.iot.domain.device.event;

import com.vex.iot.common.util.IdGenerator;
import com.vex.iot.domain.event.IEvent;
import lombok.Data;

import java.time.LocalDateTime;
import java.util.List;

@Data
public final class PointSortOrderChangedEvent implements DeviceEvent<List<String>> {

    public static final String CATEGORY = "point.sort-changed";

    private final IEvent.Metadata metadata;
    private final List<String> payload;

    public PointSortOrderChangedEvent(String tenantId, String deviceId, List<String> pointIds, String operatorId) {
        this.metadata = new IEvent.Metadata(
                IdGenerator.snowId(),
                tenantId,
                DOMAIN_SOURCE,
                LocalDateTime.now(),
                deviceId,
                null,
                CATEGORY
        );
        this.payload = pointIds;
    }
}