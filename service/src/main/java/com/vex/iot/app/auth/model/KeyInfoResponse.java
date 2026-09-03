package com.vex.iot.app.auth.model;

import java.time.Instant;

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
        Instant createdAt,

        /**
         * 时间窗起始时间戳
         */
        Long windowStart,

        /**
         * 时间窗秒数
         */
        Integer windowSeconds
) {
}
