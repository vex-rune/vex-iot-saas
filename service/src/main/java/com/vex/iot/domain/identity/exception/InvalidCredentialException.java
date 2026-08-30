package com.vex.iot.domain.identity.exception;

/**
 * 用户凭证无效异常
 */
public class InvalidCredentialException extends com.vex.iot.common.exception.BizException {
    public static final String CODE = "invalid_credential";

    public InvalidCredentialException() {
        super(CODE);
    }

    public InvalidCredentialException(String msg) {
        super(CODE, msg);
    }
}
