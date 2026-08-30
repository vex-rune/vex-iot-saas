package com.vex.iot.domain.auth.exception;

/**
 * Token无效异常
 */
public class TokenInvalidException extends com.vex.iot.common.exception.BizException {
    public static final String CODE = "token_invalid";

    public TokenInvalidException(String msg) {
        super(CODE, msg);
    }
}
