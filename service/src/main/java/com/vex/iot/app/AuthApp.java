package com.vex.iot.app;

import com.vex.iot.app.auth.config.JwtAuthenticationToken;
import com.vex.iot.app.auth.config.UserRefreshTokenAuthenticationToken;
import com.vex.iot.app.auth.model.*;
import com.vex.iot.app.auth.util.DynamicKeyVerifier;
import com.vex.iot.app.auth.util.JwtHandler;
import com.vex.iot.common.constants.RoleConstants;
import com.vex.iot.common.exception.UnauthorizedException;
import com.vex.iot.common.model.CurrentUser;
import com.vex.iot.common.util.UserContext;
import com.vex.iot.domain.identity.AccountService;
import com.vex.iot.domain.identity.TenantService;
import com.vex.iot.domain.identity.exception.InvalidCredentialException;
import com.vex.iot.domain.identity.model.AccountEntity;
import com.vex.iot.domain.identity.model.TenantEntity;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Set;

/**
 * 鉴权应用层 — 登录/密钥/当前用户(聚合)。
 *
 * <p>整合 {@code app.auth.*} 安全框架配置 与 {@code domain.identity.AccountServer} 账号服务;
 * 具体的 Provider/JWT/Filter 拆分放在 {@code app.auth.*} 子包。
 *
 * <p>三条"颁发 token"路径走同一个 {@link AuthenticationManager}:
 * <ul>
 *   <li>{@code loginType=ADMIN}   → {@code AdminAuthenticationProvider};</li>
 *   <li>{@code loginType=USER}    → {@code UserAuthenticationProvider};</li>
 *   <li>{@code loginType=REFRESH} → {@code UserRefreshTokenAuthenticationProvider}
 *       (支持续命或切换租户)。</li>
 * </ul>
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class AuthApp {

    /**
     * 管理员用户名,与 AdminAuthenticationProvider 中常量保持一致。
     */
    private static final String ADMIN_USERNAME = "admin";
    private static final String ADMIN_TENANT_ID = "0";

    private final AccountService accountService;
    private final TenantService tenantService;
    private final JwtHandler jwtHandler;
    private final AuthenticationManager authenticationManager;

    public static LoginUser toLoginUser(AccountEntity user, String tenantId) {
        return LoginUser.builder()
                .userId(user.getId())
                .username(user.getUsername())
                .tenantId(tenantId)
                .roles(user.getRoles() == null ? Set.of() : user.getRoles())
                .build();
    }

    private static LoginUser buildAdminLoginUser() {
        return LoginUser.builder()
                .userId(ADMIN_USERNAME)
                .username(ADMIN_USERNAME)
                .tenantId(ADMIN_TENANT_ID)
                .roles(Set.of(RoleConstants.SUPER_ADMIN))
                .build();
    }

    // ==================== 私有工具方法 ====================

    /**
     * 登录 / 换发 token 统一入口。
     *
     * @param loginType      ADMIN/USER 走认证;REFRESH 走 refresh token 换发(可携带 targetTenantId 切换租户)
     * @param username       ADMIN/USER 必填;REFRESH 可空(后端从 refreshToken 解析)
     * @param challenge      USER=密码明文;ADMIN=占位;REFRESH=占位
     * @param signature      ADMIN=动态码;USER/REFRESH=占位
     * @param refreshToken   REFRESH 必填;其他类型可空
     * @param targetTenantId REFRESH 切换租户时使用;null/空=维持原租户
     */
    public TokenPairResp login(LoginType loginType, String username, String challenge, String signature,
                               String refreshToken, String targetTenantId) {
        Authentication authRequest;
        switch (loginType) {
            case ADMIN -> authRequest = new JwtAuthenticationToken(username, challenge, signature);
            case USER -> authRequest = new UsernamePasswordAuthenticationToken(username, challenge);
            case REFRESH -> authRequest = new UserRefreshTokenAuthenticationToken(refreshToken, targetTenantId);
            default -> throw new IllegalArgumentException("不支持的 loginType: " + loginType);
        }

        Authentication authResult;
        try {
            authResult = authenticationManager.authenticate(authRequest);
        } catch (org.springframework.security.core.AuthenticationException e) {
            throw new InvalidCredentialException("账号或凭证不正确");
        }

        // 三条路径下,最终都拿到一个 LoginUser,签发 token 对
        LoginUser loginUser = switch (loginType) {
            case ADMIN -> buildAdminLoginUser();
            case USER -> resolveLoginUserFromPrincipal(username);
            case REFRESH -> ((UserRefreshTokenAuthenticationToken) authResult).getAuthenticatedUser();
        };

        return issueTokenPair(loginUser, username, loginType);
    }

    /**
     * 从登录结果中解析最终的 {@link LoginUser}。
     * provider 已经做了账号存在/启停/中间表可用/租户可用等校验,这里只是把第一个可用租户
     * 落到 LoginUser.tenantId 上。
     */
    private LoginUser resolveLoginUserFromPrincipal(String username) {
        AccountEntity user = accountService.loadByUsername(username);
        List<TenantEntity> tenantEntities = tenantService.listTenantsOfAccount(user.getId());
        String tenantId = tenantEntities.stream()
                .filter(t -> t.isEnabled() && !t.isDeleted())
                .findFirst()
                .map(TenantEntity::getId)
                .orElse(null);
        return toLoginUser(user, tenantId);
    }

    /**
     * 颁发 access + refresh token,并处理 UserContext 更新与 lastLogin 写入。
     */
    private TokenPairResp issueTokenPair(LoginUser loginUser, String rawUsername, LoginType loginType) {
        String accessToken = jwtHandler.generate(loginUser, JwtHandler.TokenType.ACCESS);
        String refreshToken = jwtHandler.generate(loginUser, JwtHandler.TokenType.REFRESH);

        CurrentUser cu = new CurrentUser(loginUser.userId(), loginUser.username(),
                rawUsername, loginUser.tenantId(), loginUser.roles());
        UserContext.set(cu);
        try {
            if (loginType == LoginType.USER) {
                accountService.updateLastLogin(rawUsername);
            }
        } finally {
            UserContext.clear();
        }

        return new TokenPairResp(
                accessToken,
                refreshToken,
                JwtHandler.TokenExpire.ACCESS.getSeconds(),
                JwtHandler.TokenExpire.REFRESH.getSeconds()
        );
    }

    /**
     * 获取密钥信息
     */
    public KeyInfoResponse getKeyInfo(String username) {
        return new KeyInfoResponse(
                null,
                null,
                System.currentTimeMillis() / 1000,
                DynamicKeyVerifier.DEFAULT_WINDOW_SECONDS
        );
    }

    /**
     * 获取当前用户信息
     */
    public CurrentUserResponse getCurrentUser() {
        CurrentUser cu = UserContext.current().orElse(null);
        if (cu == null) {
            throw new UnauthorizedException();
        }
        return new CurrentUserResponse(
                cu.userId(),
                cu.username(),
                cu.tenantId(),
                cu.roles()
        );
    }

    public List<TenantEntity> findTenantByUser(String userId) {
        return tenantService.listTenantsOfAccount(userId);
    }
}