package com.vex.iot.domain.device.exception;

/**
 * 设备不存在异常
 */
public class DeviceNotFoundException extends com.vex.iot.common.exception.BizException {
    public static final String CODE = "device_not_found";

    public DeviceNotFoundException() {
        super(CODE);
    }

    public DeviceNotFoundException(String deviceCode) {
        super(CODE, "设备不存在: " + deviceCode);
    }
}
