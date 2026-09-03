package com.vex.iot.app.auth.config;

import com.vex.iot.app.AuthApp;
import com.vex.iot.app.auth.model.LoginUser;
import com.vex.iot.app.auth.util.JwtHandler;
import com.vex.iot.domain.identity.AccountService;
import com.vex.iot.domain.identity.TenantService;
import com.vex.iot.domain.identity.exception.InvalidCredentialException;
import com.vex.iot.domain.identity.model.AccountEntity;
import com.vex.iot.domain.identity.model.TenantEntity;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.authentication.AuthenticationProvider;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.DisabledException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * 普通用户认证提供者
 *
 * <p>实现 Spring Security 标准 AuthenticationProvider 接口，
 * 使用账号密码方式验证普通用户凭证。
 *
 * <p>登录校验串联:
 * <ol>
 *   <li>账号存在性 + 密码正确性</li>
 *   <li>{@link AccountEntity#isEnabled()} — 账号本体未被全局禁用</li>
 *   <li>{@link AccountService#hasUsableLink(String)} — 至少有一条活的中间表授权(state 正常 + enabled=true)</li>
 *   <li>关联租户可用性 — 至少有一个租户未被禁用/软删</li>
 * </ol>
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class UserAuthenticationProvider implements AuthenticationProvider {

    /**
     * 用户服务
     */
    private final AccountService userServer;

    /**
     * JWT工具类
     */
    private final JwtHandler jwtHandler;
    private final TenantService tenantService;

    private static boolean isEnabled(TenantEntity t) {
        return t.isEnabled() && !t.isDeleted();
    }

    /**
     * 支持的认证令牌类型
     *
     * @param authentication 认证令牌
     * @return 是否支持
     */
    @Override
    public boolean supports(Class<?> authentication) {
        return UsernamePasswordAuthenticationToken.class.isAssignableFrom(authentication);
    }

    /**
     * 认证逻辑
     *
     * @param authentication 认证请求
     * @return 认证结果
     * @throws AuthenticationException 认证异常
     */
    @Override
    public Authentication authenticate(Authentication authentication) throws AuthenticationException {
        UsernamePasswordAuthenticationToken token = (UsernamePasswordAuthenticationToken) authentication;
        String username = token.getName();
        String password = (String) token.getCredentials();

        // 加载用户
        AccountEntity user = userServer.loadByUsername(username);

        // 验证账号密码
        userServer.verifyPassword(user, password);

        // 验证账号本体是否启用
        if (!user.isEnabled()) {
            throw new DisabledException("用户已被禁用");
        }

        // 多租户守卫-1:中间表 enabled — 账号必须在至少一个租户下处于"启用且未软删"
        if (!userServer.hasUsableLink(user.getId())) {
            throw new InvalidCredentialException("账号在所有租户下均已被禁用");
        }

        // 多租户守卫-2:租户可用性 — 账号的关联租户中至少有一个可用
        List<TenantEntity> tenantEntities = tenantService.listTenantsOfAccount(user.getId());
        if (tenantEntities.isEmpty()) {
            // 中间表已校验过至少有活行,这里再保护一次:极端情况下 tenant 表已被清
            throw new InvalidCredentialException("账号未关联到任何可用租户");
        }
        boolean anyTenantUsable = tenantEntities.stream()
                .anyMatch(t -> isEnabled(t));
        if (!anyTenantUsable) {
            throw new InvalidCredentialException("账号关联的租户全部不可用");
        }

        // 验证是否为管理员角色
        if (userServer.isAdmin(user)) {
            throw new BadCredentialsException("管理员用户，请使用动态码登录");
        }

        // 转换为登录用户 — 取第一个可用租户作为主租户
        LoginUser loginUser = AuthApp.toLoginUser(user,
                tenantEntities.stream()
                        .filter(UserAuthenticationProvider::isEnabled)
                        .findFirst()
                        .map(TenantEntity::getId)
                        .orElse(null));

        // 生成权限集合
        Set<SimpleGrantedAuthority> authorities = loginUser.roles().stream()
                .map(SimpleGrantedAuthority::new)
                .collect(Collectors.toSet());

        // 生成认证成功的令牌
        String jwtToken = jwtHandler.generate(loginUser, JwtHandler.TokenType.ACCESS);
        log.debug("用户 {} 认证成功，生成JWT令牌", username);

        // 返回认证成功的令牌
        return new UsernamePasswordAuthenticationToken(username, password, authorities);
    }
}