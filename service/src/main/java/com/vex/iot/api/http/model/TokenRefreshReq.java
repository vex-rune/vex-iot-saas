package com.vex.iot.api.http.model;

import jakarta.validation.constraints.NotBlank;

/**
 * Token刷新请求
 */
public record TokenRefreshReq(
    /**
     * 刷新令牌
     */
    @NotBlank String refreshToken
) {}
