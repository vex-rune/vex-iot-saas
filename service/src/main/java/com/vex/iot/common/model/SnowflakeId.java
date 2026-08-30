package com.vex.iot.common.model;

import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/**
 * 标记 JPA 实体的主键字段由雪花算法自动生成。
 *
 * <p>实际写入由 {@link SnowflakeIdListener} 在 {@code @PrePersist} 阶段完成。
 * 字段类型必须为 {@code String}。
 */
@Target(ElementType.FIELD)
@Retention(RetentionPolicy.RUNTIME)
public @interface SnowflakeId {

    /**
     * ID 前缀(可选)。为空时取实体类名前 3 位大写。
     */
    String value() default "";
}