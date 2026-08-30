package com.vex.iot.domain.alarm.exception;

/**
 * 报警规则不存在异常
 */
public class AlarmRuleNotFoundException extends com.vex.iot.common.exception.BizException {
    public static final String CODE = "alarm_rule_not_found";

    public AlarmRuleNotFoundException(String id) {
        super(CODE, "报警规则不存在: " + id);
    }
}
