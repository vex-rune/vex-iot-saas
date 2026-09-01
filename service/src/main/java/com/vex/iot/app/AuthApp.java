package com.vex.iot.app;

import com.vex.iot.app.auth.model.CurrentUserResponse;
import com.vex.iot.app.auth.model.KeyInfoResponse;
import com.vex.iot.app.auth.model.LoginType;
import com.vex.iot.app.auth.model.LoginUser;
import com.vex.iot.app.auth.model.TokenPairResp;
import com.vex.iot.app.auth.config.JwtAuthenticationToken;
import com.vex.iot.app.auth.util.DynamicKeyVerifier;
import com.vex.iot.app.auth.util.JwtHandler;
import com.vex.iot.common.constants.RoleConstants;
import com.vex.iot.common.exception.BusinessExceptions.UnauthorizedException;
import com.vex.iot.common.model.CurrentUser;
import com.vex.iot.common.util.UserContext;
import com.vex.iot.domain.identity.AccountService;
import com.vex.iot.domain.identity.exception.InvalidCredentialException;
import com.vex.iot.domain.identity.model.AccountEntity;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Component;

import java.util.Set;

/**
 * 鉴权应用层 — 登录/密钥/当前用户/刷新令牌(聚合)。
 *
 * <p>整合 {@code app.auth.*} 安全框架配置 与 {@code domain.identity.AccountServer} 账号服务;
 * 具体的 Provider/JWT/Filter 拆分放在 {@code app.auth.*} 子包。
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class AuthApp {

    /** 管理员用户名,与 AdminAuthenticationProvider 中常量保持一致。 */
    private static final String ADMIN_USERNAME = "admin";
    private static final String ADMIN_TENANT_ID = "0";

    private final AccountService userServer;
    private final JwtHandler jwtHandler;
    private final AuthenticationManager authenticationManager;

    public static LoginUser toLoginUser(AccountEntity user) {
        return LoginUser.builder()
                .userId(user.getId())
                .username(user.getUsername())
                .tenantId(user.getTenantId())
                .roles(user.getRoles() == null ? Set.of() : user.getRoles())
                .build();
    }

    /**
     * 登录
     *
     * @param loginType  ADMIN 走动态码;USER 走账密
     * @param username  用户名
     * @param challenge USER 类型=密码明文;ADMIN 类型=任意占位(后端忽略)
     * @param signature ADMIN 类型=动态码;USER 类型=任意占位(后端忽略)
     * @return 登录响应
     */
    public TokenPairResp login(LoginType loginType, String username, String challenge, String signature) {
        Authentication authRequest = switch (loginType) {
            case ADMIN -> new JwtAuthenticationToken(username, challenge, signature);
            case USER -> new UsernamePasswordAuthenticationToken(username, challenge);
        };

        try {
            authenticationManager.authenticate(authRequest);
        } catch (org.springframework.security.core.AuthenticationException e) {
            throw new InvalidCredentialException("认证失败: " + e.getMessage());
        }

        LoginUser loginUser = (loginType == LoginType.ADMIN)
                ? buildAdminLoginUser()
                : toLoginUser(userServer.loadByUsername(username));

        String accessToken = jwtHandler.generate(loginUser, JwtHandler.TokenType.ACCESS);
        String refreshToken = jwtHandler.generate(loginUser, JwtHandler.TokenType.REFRESH);

        CurrentUser cu = new CurrentUser(loginUser.userId(), loginUser.username(),
                username, loginUser.tenantId(), loginUser.roles());
        UserContext.set(cu);
        try {
            if (loginType == LoginType.USER) {
                userServer.updateLastLogin(username);
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

    private static LoginUser buildAdminLoginUser() {
        return LoginUser.builder()
                .userId(ADMIN_USERNAME)
                .username(ADMIN_USERNAME)
                .tenantId(ADMIN_TENANT_ID)
                .roles(Set.of(RoleConstants.SUPER_ADMIN))
                .build();
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

    /**
     * 使用刷新令牌换取新的业务令牌
     */
    public TokenPairResp refreshToken(String refreshToken) {
        LoginUser loginUser = jwtHandler.parse(refreshToken, JwtHandler.TokenType.REFRESH);

        AccountEntity user = userServer.loadByUsername(loginUser.username());
        if (!user.isEnabled()) {
            throw new BadCredentialsException("用户已被禁用");
        }

        LoginUser newLoginUser = toLoginUser(user);
        String newAccessToken = jwtHandler.generate(newLoginUser, JwtHandler.TokenType.ACCESS);
        String newRefreshToken = jwtHandler.generate(newLoginUser, JwtHandler.TokenType.REFRESH);

        log.debug("用户 {} 的 Token 刷新成功", loginUser.username());

        return new TokenPairResp(
                newAccessToken,
                newRefreshToken,
                JwtHandler.TokenExpire.ACCESS.getSeconds(),
                JwtHandler.TokenExpire.REFRESH.getSeconds()
        );
    }
}