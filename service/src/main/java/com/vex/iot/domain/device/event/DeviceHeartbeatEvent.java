package com.vex.iot.domain.device.event;

/**
 * 设备心跳事件 — 设备上报心跳后发布。
 */
public record DeviceHeartbeatEvent(String deviceId) {
}
