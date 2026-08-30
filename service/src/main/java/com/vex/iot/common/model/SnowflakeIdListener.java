package com.vex.iot.common.model;

import cn.hutool.core.util.IdUtil;
import jakarta.persistence.PrePersist;

import java.lang.reflect.Field;
import java.util.Locale;

/**
 * JPA 实体持久化前自动写入雪花 ID。
 *
 * <p>扫描实体自身及父类的 {@link SnowflakeId} 字段,值为空才填充。
 */
public class SnowflakeIdListener {

    @PrePersist
    public void assignId(Object entity) {
        try {
            Field field = findIdField(entity.getClass());
            if (field == null) return;

            field.setAccessible(true);
            if (field.get(entity) != null) return;

            String prefix = resolvePrefix(entity);
            String id = prefix + "_" + IdUtil.getSnowflake(1L, 1L).nextId();
            field.set(entity, id);
        } catch (Exception ex) {
            throw new RuntimeException("SnowflakeIdListener: ID 生成失败", ex);
        }
    }

    private static Field findIdField(Class<?> clazz) {
        Class<?> current = clazz;
        while (current != null && current != Object.class) {
            for (Field field : current.getDeclaredFields()) {
                if (field.isAnnotationPresent(SnowflakeId.class)) {
                    return field;
                }
            }
            current = current.getSuperclass();
        }
        return null;
    }

    private static String resolvePrefix(Object entity) {
        SnowflakeId annotation = entity.getClass().getAnnotation(SnowflakeId.class);
        if (annotation != null && !annotation.value().isEmpty()) {
            return annotation.value();
        }
        String simpleName = entity.getClass().getSimpleName();
        return simpleName.length() < 3
                ? simpleName.toLowerCase(Locale.ROOT)
                : simpleName.substring(0, 3).toUpperCase(Locale.ROOT);
    }
}