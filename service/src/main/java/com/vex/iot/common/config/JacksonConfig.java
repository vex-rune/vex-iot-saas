package com.vex.iot.common.config;

import com.fasterxml.jackson.databind.SerializationFeature;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import org.springframework.boot.autoconfigure.jackson.Jackson2ObjectMapperBuilderCustomizer;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Jackson 序列化统一配置。
 *
 * <p>全局规则:
 * <ul>
 *   <li>{@link java.time.Instant} / {@link java.time.LocalDateTime} 等时间类型
 *       一律输出 ISO 8601 字符串,带 {@code Z} 时区标记;</li>
 *   <li>{@code WRITE_DATES_AS_TIMESTAMPS = false} 禁止输出 epoch 毫秒数字;</li>
 *   <li>{@code WRITE_DATES_WITH_ZONE_ID = false} 避免 JSON 里出现
 *       形如 {@code ["2026-09-03T09:14:48","UTC"]} 的二元组。</li>
 * </ul>
 *
 * <p>后端所有 API 响应里的时间字段(例如 {@code DataEntity.timestamp}、
 * {@code DataEntity.ingestedAt}、{@code BaseEntity.createdAt/updatedAt})都遵循此约定;
 * 前端 {@code types/api.ts} 中相应字段均为 {@code string},ISO 字符串可直接
 * 通过 {@code new Date(s)} 解析。</p>
 */
@Configuration
public class JacksonConfig {

    @Bean
    public Jackson2ObjectMapperBuilderCustomizer jacksonTimeCustomizer() {
        return builder -> builder
                .modulesToInstall(new JavaTimeModule())
                .featuresToDisable(
                        SerializationFeature.WRITE_DATES_AS_TIMESTAMPS,
                        SerializationFeature.WRITE_DATES_WITH_ZONE_ID);
    }
}