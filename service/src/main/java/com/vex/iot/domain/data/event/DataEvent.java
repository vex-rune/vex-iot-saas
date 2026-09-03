package com.vex.iot.domain.data.event;

import com.vex.iot.domain.event.IEvent;

/**
 * Data 域事件统一标记接口 — 继承 {@link IEvent}，提供域 source 常量。
 *
 * <p>实现类只需显式提供 {@code metadata} + {@code payload} 两个字段：
 * <pre>{@code
 * @Data
 * public final class DataUpdateEvent implements DataEvent<DataEntity> {
 *     public static final String CATEGORY = "data.update";
 *     private final Metadata metadata;
 *     private final DataEntity payload;
 * }
 * }</pre>
 *
 * @author Vex
 * @since 1.0
 */
public interface DataEvent<T> extends IEvent<T> {

    String DOMAIN_SOURCE = "data-service";

    @Override
    default String source() {
        return DOMAIN_SOURCE;
    }
}