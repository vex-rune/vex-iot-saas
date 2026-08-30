package com.vex.iot.app.http.model;

import java.time.LocalDateTime;

/**
 * 设备在线状态响应
 */
public record DeviceOnlineResponse(
    /**
     * 设备ID
     */
    String deviceId,

    /**
     * 设备编码
     */
    String deviceCode,

    /**
     * 在线状态
     */
    Boolean online,

    /**
     * 是否启用
     */
    Boolean enabled,

    /**
     * 最后心跳时间
     */
    LocalDateTime lastHeartbeatAt
) {}
