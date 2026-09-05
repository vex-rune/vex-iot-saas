package com.vex.iot.app.auth.config;

import com.vex.iot.app.auth.model.LoginUser;
import com.vex.iot.app.auth.util.DynamicKeyVerifier;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.authentication.AuthenticationProvider;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.stereotype.Component;

import java.util.Set;

/**
 * 管理员认证提供者
 *
 * <p>实现 Spring Security 标准 AuthenticationProvider 接口，
 * 管理员（用户名固定为 admin）使用动态码登录，无需密码。
 * admin 用户信息完全写死在代码中，不存储在数据库中。
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class AdminAuthenticationProvider implements AuthenticationProvider {

    /**
     * 固定的管理员用户名
     */
    private static final String ADMIN_USERNAME = "admin";

    /**
     * 管理员租户ID
     */
    private static final String ADMIN_TENANT_ID = "0";

    /**
     * 管理员角色
     */
    private static final String ADMIN_ROLE = "SUPER_ADMIN";

    private final DynamicKeyVerifier dynamicKeyVerifier;

    /**
     * 支持的认证令牌类型
     *
     * @param authentication 认证令牌
     * @return 是否支持
     */
    @Override
    public boolean supports(Class<?> authentication) {
        return JwtAuthenticationToken.class.isAssignableFrom(authentication);
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
        JwtAuthenticationToken token = (JwtAuthenticationToken) authentication;
        String username = token.getUsername();
        String code = token.getSignature();

        // 验证用户名必须为 admin
        if (!ADMIN_USERNAME.equalsIgnoreCase(username)) {
            throw new BadCredentialsException("管理员用户名错误");
        }

        // 验证动态码
        if (!dynamicKeyVerifier.verify(code)) {
            throw new BadCredentialsException("动态码验证失败");
        }

        // 构建固定的登录用户信息
        LoginUser loginUser = LoginUser.builder()
                .userId(ADMIN_USERNAME)
                .username(ADMIN_USERNAME)
                .tenantId(ADMIN_TENANT_ID)
                .roles(Set.of(ADMIN_ROLE))
                .build();

        // 生成权限集合
        Set<SimpleGrantedAuthority> authorities = loginUser.roles().stream()
                .map(SimpleGrantedAuthority::new)
                .collect(java.util.stream.Collectors.toSet());

        log.debug("管理员 {} 认证成功，生成JWT令牌", ADMIN_USERNAME);

        // 返回认证成功的令牌
        return new JwtAuthenticationToken(ADMIN_USERNAME, authorities);
    }
}
