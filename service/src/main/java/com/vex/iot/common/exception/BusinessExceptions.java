package com.vex.iot.common.exception;

/**
 * 通用业务异常合集
 *
 * <p>只包含各模块共用的通用异常，具体业务异常由各模块自行管理。
 */
public final class BusinessExceptions {

    private BusinessExceptions() {
    }

    // ===== 通用异常 =====

    public static class BadRequestException extends BizException {
        public static final String CODE = "bad_request";

        public BadRequestException(String msg) {
            super(CODE, msg);
        }
    }

    public static class UnauthorizedException extends BizException {
        public static final String CODE = "unauthorized";

        public UnauthorizedException() {
            super(CODE);
        }

        public UnauthorizedException(String msg) {
            super(CODE, msg);
        }
    }

    public static class ForbiddenException extends BizException {
        public static final String CODE = "forbidden";

        public ForbiddenException() {
            super(CODE);
        }

        public ForbiddenException(String msg) {
            super(CODE, msg);
        }
    }

    public static class NotFoundException extends BizException {
        public static final String CODE = "not_found";

        public NotFoundException(String resource) {
            super(CODE, resource + " 不存在");
        }
    }

    public static class ConflictException extends BizException {
        public static final String CODE = "conflict";

        public ConflictException(String msg) {
            super(CODE, msg);
        }
    }

    public static class InternalException extends BizException {
        public static final String CODE = "internal_error";

        public InternalException(String msg) {
            super(CODE, msg);
        }

        public InternalException(String msg, Throwable cause) {
            super(CODE, msg, cause);
        }
    }
}
