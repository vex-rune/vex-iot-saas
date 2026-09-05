package com.vex.iot.common.exception;

public class UnauthorizedException extends BizException {
    public static final String CODE = "unauthorized";

    public UnauthorizedException() {
        super(CODE);
    }

    public UnauthorizedException(String msg) {
        super(CODE, msg);
    }
}
