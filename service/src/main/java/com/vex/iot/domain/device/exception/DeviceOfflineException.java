package com.vex.iot.domain.device.exception;

/**
 * 设备离线异常
 */
public class DeviceOfflineException extends com.vex.iot.common.exception.BizException {
    public static final String CODE = "device_offline";

    public DeviceOfflineException(String msg) {
        super(CODE, msg);
    }
}
