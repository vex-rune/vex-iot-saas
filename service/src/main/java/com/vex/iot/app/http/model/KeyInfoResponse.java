package com.vex.iot.app.http.model;

import java.time.LocalDateTime;

/**
 * 密钥信息响应
 */
public record KeyInfoResponse(
    /**
     * 盐值
     */
    String salt,

    /**
     * 创建时间
     */
    LocalDateTime createdAt,

    /**
     * 时间窗起始时间戳
     */
    Long windowStart,

    /**
     * 时间窗秒数
     */
    Integer windowSeconds
) {}
