package com.vex.iot.app.auth.config;

import com.vex.iot.app.auth.model.LoginUser;
import org.springframework.security.authentication.AbstractAuthenticationToken;
import org.springframework.security.core.GrantedAuthority;

import java.util.Collection;

/**
 * 用户刷新 token 认证令牌。
 *
 * <p>用于"通过 refresh token 换取新 access token"这条路径；
 * 凭证是 refresh token 字符串，可选携带 {@code targetTenantId} 表示要切换到哪个租户。
 *
 * <p>设计风格对齐 {@link JwtAuthenticationToken}：
 * <ul>
 *   <li>未认证构造器：携带 refresh token + targetTenantId；</li>
 *   <li>已认证构造器：携带 {@link LoginUser}（tenantId 可能被 provider 改写为 targetTenantId）。</li>
 * </ul>
 */
public class UserRefreshTokenAuthenticationToken extends AbstractAuthenticationToken {

    /**
     * 待校验的 refresh token。
     */
    private final String refreshToken;

    /**
     * 客户端想切换到的目标租户 ID；{@code null} 或空 表示"维持原租户"。
     */
    private final String targetTenantId;

    /**
     * 认证成功后填充的最终登录用户信息（含新 tenantId）。
     */
    private LoginUser authenticatedUser;

    public UserRefreshTokenAuthenticationToken(String refreshToken, String targetTenantId) {
        super(null);
        this.refreshToken = refreshToken;
        this.targetTenantId = targetTenantId;
        setAuthenticated(false);
    }

    public UserRefreshTokenAuthenticationToken(LoginUser authenticatedUser,
                                               Collection<? extends GrantedAuthority> authorities) {
        super(authorities);
        this.refreshToken = null;
        this.targetTenantId = authenticatedUser != null ? authenticatedUser.tenantId() : null;
        this.authenticatedUser = authenticatedUser;
        setAuthenticated(true);
    }

    @Override
    public Object getCredentials() {
        return refreshToken;
    }

    @Override
    public Object getPrincipal() {
        return authenticatedUser != null ? authenticatedUser : refreshToken;
    }

    public String getRefreshToken() {
        return refreshToken;
    }

    public String getTargetTenantId() {
        return targetTenantId;
    }

    public LoginUser getAuthenticatedUser() {
        return authenticatedUser;
    }

    public void setAuthenticatedUser(LoginUser authenticatedUser) {
        this.authenticatedUser = authenticatedUser;
    }
}