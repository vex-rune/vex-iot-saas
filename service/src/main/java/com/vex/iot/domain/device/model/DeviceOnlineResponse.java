package com.vex.iot.domain.device.model;

import java.time.Instant;

/**
 * 设备在线状态响应
 */
public record DeviceOnlineResponse(
        /**
         * 设备ID
         */
        String deviceId,

        /**
         * 设备名称
         */
        String deviceName,

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
        Instant lastHeartbeatAt
) {
}
