package com.vex.iot.common.exception;

public class NotFoundException extends BizException {
    public static final String CODE = "not_found";

    public NotFoundException(String resource) {
        super(CODE, resource + " 不存在");
    }
}
