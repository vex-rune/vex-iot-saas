package com.vex.iot.domain.schedule.exception;

import com.vex.iot.common.exception.BusinessExceptions.NotFoundException;

/**
 * 设备定时控制规则不存在
 */
public class DeviceScheduleNotFoundException extends NotFoundException {
    public DeviceScheduleNotFoundException(String id) {
        super("设备定时规则不存在: " + id);
    }
}
