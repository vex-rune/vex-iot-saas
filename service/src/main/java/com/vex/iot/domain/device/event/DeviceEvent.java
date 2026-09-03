package com.vex.iot.domain.device.event;

import com.vex.iot.domain.event.IEvent;

/**
 * Device 域事件统一标记接口 — 继承 {@link IEvent}，提供域 source 常量。
 *
 * @author Vex
 * @since 1.0
 */
public interface DeviceEvent<T> extends IEvent<T> {

    String DOMAIN_SOURCE = "device-service";

    @Override
    default String source() {
        return DOMAIN_SOURCE;
    }
}