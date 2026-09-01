package com.vex.iot.app.auth.model;

/**
 * Token对响应
 *
 * <p>登录成功后返回业务令牌和刷新令牌
 */
public record TokenPairResp(
    /**
     * 业务令牌（3小时有效期）
     */
    String accessToken,

    /**
     * 刷新令牌（7天有效期）
     */
    String refreshToken,

    /**
     * 业务令牌剩余有效时间（秒）
     */
    long accessExpiresIn,

    /**
     * 刷新令牌剩余有效时间（秒）
     */
    long refreshExpiresIn
) {}
