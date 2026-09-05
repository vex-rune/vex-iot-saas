package com.vex.iot.common.exception;

public class ForbiddenException extends BizException {
    public static final String CODE = "forbidden";

    public ForbiddenException() {
        super(CODE);
    }

    public ForbiddenException(String msg) {
        super(CODE, msg);
    }
}
