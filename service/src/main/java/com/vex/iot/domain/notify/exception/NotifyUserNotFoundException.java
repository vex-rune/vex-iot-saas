package com.vex.iot.domain.notify.exception;

/**
 * 通知人不存在异常
 */
public class NotifyUserNotFoundException extends com.vex.iot.common.exception.BizException {
    public static final String CODE = "notify_user_not_found";

    public NotifyUserNotFoundException(String id) {
        super(CODE, "通知人不存在: " + id);
    }
}
