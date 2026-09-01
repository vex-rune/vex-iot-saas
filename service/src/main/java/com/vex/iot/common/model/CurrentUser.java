package com.vex.iot.common.model;

import java.util.Set;

/**
 * 当前用户上下文信息,存储在 ThreadLocal 中。
 * 覆盖 HTTP 请求、MQTT 回调、@Async 异步线程等所有场景。
 */
public record CurrentUser(
        String userId,
        String username,
        String displayName,
        String tenantId,
        Set<String> roles
) {
    /**
     * MQTT/设备等非用户场景,仅填充 tenantId 和设备标识。
     */
    public static CurrentUser ofDevice(String tenantId, String deviceCode) {
        return new CurrentUser("0", "device:" + deviceCode, null, tenantId, Set.of());
    }
}
