package com.vex.iot.app.auth.config;

import com.vex.iot.app.AuthApp;
import com.vex.iot.app.auth.model.LoginUser;
import com.vex.iot.app.auth.util.JwtHandler;
import com.vex.iot.domain.identity.AccountService;
import com.vex.iot.domain.identity.model.AccountEntity;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.authentication.AuthenticationProvider;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.stereotype.Component;

import java.util.Set;
import java.util.stream.Collectors;

/**
 * 普通用户认证提供者
 *
 * <p>实现 Spring Security 标准 AuthenticationProvider 接口，
 * 使用账号密码方式验证普通用户凭证。
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

        // 验证是否为管理员角色
        if (userServer.isAdmin(user)) {
            throw new BadCredentialsException("管理员用户，请使用动态码登录");
        }

        // 验证账号密码
        userServer.verifyPassword(user, password);

        // 验证用户是否启用
        if (!user.isEnabled()) {
            throw new org.springframework.security.authentication.DisabledException("用户已被禁用");
        }

        // 转换为登录用户
        LoginUser loginUser = AuthApp.toLoginUser(user);

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
