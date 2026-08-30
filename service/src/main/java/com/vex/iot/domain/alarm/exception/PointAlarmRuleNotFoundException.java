package com.vex.iot.domain.alarm.exception;

import com.vex.iot.common.exception.BizException;

public class PointAlarmRuleNotFoundException extends BizException {
    public static final String CODE = "point_alarm_rule_not_found";

    public PointAlarmRuleNotFoundException(String id) {
        super(CODE, "告警规则不存在: " + id);
    }
}
