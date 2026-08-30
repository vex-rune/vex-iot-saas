package com.vex.iot.domain.alarm.exception;

import com.vex.iot.common.exception.BizException;

public class PointAlarmEventNotFoundException extends BizException {
    public static final String CODE = "point_alarm_event_not_found";

    public PointAlarmEventNotFoundException(String id) {
        super(CODE, "告警事件不存在: " + id);
    }
}
