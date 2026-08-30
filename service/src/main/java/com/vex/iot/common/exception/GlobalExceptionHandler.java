package com.vex.iot.common.exception;

import com.vex.iot.common.response.Response;
import jakarta.validation.ConstraintViolationException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.web.HttpRequestMethodNotSupportedException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.servlet.NoHandlerFoundException;

import java.util.stream.Collectors;

@RestControllerAdvice
public class GlobalExceptionHandler {
    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    private static HttpStatus toHttpStatus(String code) {
//        if ("forbidden".equals(code)) return HttpStatus.FORBIDDEN;
//        if ("unauthorized".equals(code)) return HttpStatus.UNAUTHORIZED;
//        if ("not_found".equals(code)) return HttpStatus.NOT_FOUND;
//        if ("conflict".equals(code)) return HttpStatus.CONFLICT;
//        if ("method_not_allowed".equals(code)) return HttpStatus.METHOD_NOT_ALLOWED;
//        if (code.startsWith("internal_error")) return HttpStatus.INTERNAL_SERVER_ERROR;
        return HttpStatus.OK;
    }

    // 业务异常
    @ExceptionHandler(BizException.class)
    public ResponseEntity<Response<Void>> handleBiz(BizException ex) {
        log.warn("业务异常 code={} msg={}", ex.getCode(), ex.getMessage());
        return ResponseEntity.status(HttpStatus.OK)
                .body(Response.fail(ex.getCode(), ex.getMessage()));
    }

    // 校验约束异常
    @ExceptionHandler(ConstraintViolationException.class)
    public ResponseEntity<Response<Void>> handleConstraint(ConstraintViolationException ex) {
        String msg = ex.getConstraintViolations().stream()
                .map(c -> c.getMessage()).collect(Collectors.joining("; "));
        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                .body(Response.fail("bad_request", msg));
    }

    // 校验约束异常
    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<Response<Void>> handleValid(MethodArgumentNotValidException ex) {
        String msg = ex.getBindingResult().getFieldErrors().stream()
                .map(e -> e.getField() + ": " + e.getDefaultMessage())
                .collect(Collectors.joining("; "));
        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                .body(Response.fail("bad_request", msg));
    }

    // 请求体格式异常
    @ExceptionHandler(HttpMessageNotReadableException.class)
    public ResponseEntity<Response<Void>> handleUnreadable(HttpMessageNotReadableException ex) {
        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                .body(Response.fail("bad_request", "请求体格式错误" + ex.getMessage()));
    }

    // 请求方法异常
    @ExceptionHandler(HttpRequestMethodNotSupportedException.class)
    public ResponseEntity<Response<Void>> handleMethod(HttpRequestMethodNotSupportedException ex) {
        return ResponseEntity.status(HttpStatus.METHOD_NOT_ALLOWED)
                .body(Response.fail("method_not_allowed", ex.getMessage()));
    }

    // 资源不存在异常
    @ExceptionHandler(NoHandlerFoundException.class)
    public ResponseEntity<Response<Void>> handleNotFound(NoHandlerFoundException ex) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND)
                .body(Response.fail("not_found", "资源不存在" + ex.getMessage()));
    }

    // 访问权限异常
    @ExceptionHandler(AccessDeniedException.class)
    public ResponseEntity<Response<Void>> handleAccess(AccessDeniedException ex) {
        return ResponseEntity.status(HttpStatus.FORBIDDEN)
                .body(Response.fail("forbidden", "无权限访问" + ex.getMessage()));
    }

    // 系统异常
    @ExceptionHandler(Exception.class)
    public ResponseEntity<Response<Void>> handleAll(Exception ex) {
        log.error("系统异常", ex);
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(Response.fail("internal_error", "系统内部异常" + ex.getMessage()));
    }
}
