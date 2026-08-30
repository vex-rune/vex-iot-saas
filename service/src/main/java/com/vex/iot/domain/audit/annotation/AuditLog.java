package com.vex.iot.domain.audit.annotation;

import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/**
 * 审计日志注解
 *
 * <p>标记需要审计的方法。AuditAspect 会拦截，异步写入 operation_log。
 */
@Retention(RetentionPolicy.RUNTIME)
@Target(ElementType.METHOD)
public @interface AuditLog {

    /**
     * 操作类型
     *
     * @return 操作类型
     */
    String action();

    /**
     * 资源类型
     *
     * @return 资源类型
     */
    String resourceType() default "";
}
