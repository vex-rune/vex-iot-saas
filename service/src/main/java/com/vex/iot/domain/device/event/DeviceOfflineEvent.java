package com.vex.iot.domain.device.event;

import com.vex.iot.common.util.IdGenerator;
import com.vex.iot.domain.event.IEvent;
import lombok.Data;

import java.time.LocalDateTime;

@Data
public final class DeviceOfflineEvent implements DeviceEvent<String> {

    public static final String CATEGORY = "device.online.offline";

    private final IEvent.Metadata metadata;
    private final String payload;

    public DeviceOfflineEvent(String tenantId, String deviceId, LocalDateTime offlineAt) {
        this.metadata = new IEvent.Metadata(
                IdGenerator.snowId(),
                tenantId,
                DOMAIN_SOURCE,
                offlineAt == null ? LocalDateTime.now() : offlineAt,
                deviceId,
                null,
                CATEGORY
        );
        this.payload = deviceId;
    }
}