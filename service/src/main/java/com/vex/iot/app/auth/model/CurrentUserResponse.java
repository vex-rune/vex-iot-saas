package com.vex.iot.app.auth.model;

import java.util.Set;

/**
 * 当前用户信息响应
 */
public record CurrentUserResponse(
    /**
     * 用户ID
     */
    String userId,

    /**
     * 用户名
     */
    String username,

    /**
     * 租户ID
     */
    String tenantId,

    /**
     * 角色集合
     */
    Set<String> roles
) {}
