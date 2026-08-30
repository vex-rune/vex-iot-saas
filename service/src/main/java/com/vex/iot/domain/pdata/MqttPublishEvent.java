package com.vex.iot.domain.pdata;

import org.springframework.context.ApplicationEvent;

public class MqttPublishEvent extends ApplicationEvent {
    private final String deviceCode;
    private final byte[] payload;

    public MqttPublishEvent(Object source, String deviceCode, byte[] payload) {
        super(source);
        this.deviceCode = deviceCode;
        this.payload = payload;
    }

    public String getDeviceCode() {
        return deviceCode;
    }

    public byte[] getPayload() {
        return payload;
    }
}
