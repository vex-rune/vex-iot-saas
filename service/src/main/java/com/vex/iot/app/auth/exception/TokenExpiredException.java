package com.vex.iot.app.auth.exception;

/**
 * Token过期异常
 */
public class TokenExpiredException extends com.vex.iot.common.exception.BizException {
    public static final String CODE = "token_expired";

    public TokenExpiredException() {
        super(CODE);
    }
}
