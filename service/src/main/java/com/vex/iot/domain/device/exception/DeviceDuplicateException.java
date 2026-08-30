package com.vex.iot.domain.device.exception;

/**
 * 设备编号重复异常
 */
public class DeviceDuplicateException extends com.vex.iot.common.exception.BizException {
    public static final String CODE = "device_duplicate";

    public DeviceDuplicateException(String deviceCode) {
        super(CODE, "设备编号已存在: " + deviceCode);
    }
}
