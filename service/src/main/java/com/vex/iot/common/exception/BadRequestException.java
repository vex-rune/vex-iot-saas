package com.vex.iot.common.exception;

public class BadRequestException extends BizException {
    public static final String CODE = "bad_request";

    public BadRequestException(String msg) {
        super(CODE, msg);
    }
}
