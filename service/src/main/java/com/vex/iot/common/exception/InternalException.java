package com.vex.iot.common.exception;

public class InternalException extends BizException {
    public static final String CODE = "internal_error";

    public InternalException(String msg) {
        super(CODE, msg);
    }

    public InternalException(String msg, Throwable cause) {
        super(CODE, msg, cause);
    }
}
