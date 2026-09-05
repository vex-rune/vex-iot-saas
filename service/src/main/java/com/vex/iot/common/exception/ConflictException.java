package com.vex.iot.common.exception;

public class ConflictException extends BizException {
    public static final String CODE = "conflict";

    public ConflictException(String msg) {
        super(CODE, msg);
    }
}
