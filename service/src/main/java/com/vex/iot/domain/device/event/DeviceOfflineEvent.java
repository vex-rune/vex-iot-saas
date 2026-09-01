package com.vex.iot.domain.device.event;

/**
 * 设备离线事件 — 设备 Will 消息触发后发布。
 */
public record DeviceOfflineEvent(String deviceId) {
}
