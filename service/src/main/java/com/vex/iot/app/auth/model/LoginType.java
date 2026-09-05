package com.vex.iot.app.auth.model;

import com.vex.iot.common.config.IEnum;

/**
 * 登录类型。
 *
 * <p>{@code REFRESH} 表示"用 refresh token 换发新 token"(同时支持切换租户);
 * 入参通过 {@code refreshToken} 与 {@code targetTenantId} 字段传递,
 * 由 {@code UserRefreshTokenAuthenticationProvider} 处理。
 */
public enum LoginType implements IEnum {
    /**
     * 管理员动态码登录。
     */
    ADMIN,
    /**
     * 普通用户账密登录。
     */
    USER,
    /**
     * 用 refresh token 换发(可携带 targetTenantId 切换租户)。
     */
    REFRESH;

    


    
    @Override
    public String displayName() {
        return name();
    }
}