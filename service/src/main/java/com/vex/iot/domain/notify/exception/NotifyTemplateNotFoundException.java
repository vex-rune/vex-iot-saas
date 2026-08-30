package com.vex.iot.domain.notify.exception;

/**
 * 通知模版不存在异常
 */
public class NotifyTemplateNotFoundException extends com.vex.iot.common.exception.BizException {
    public static final String CODE = "notify_template_not_found";

    public NotifyTemplateNotFoundException(String id) {
        super(CODE, "通知模版不存在: " + id);
    }
}
