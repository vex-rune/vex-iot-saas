package com.vex.iot.app.auth.config;

import org.springframework.security.authentication.AbstractAuthenticationToken;
import org.springframework.security.core.GrantedAuthority;

import java.util.Collection;

/**
 * JWT认证令牌
 *
 * <p>用于封装动态密钥认证的认证信息，包含用户名、challenge和signature。
 */
public class JwtAuthenticationToken extends AbstractAuthenticationToken {

    /**
     * 用户名
     */
    private final String username;

    /**
     * 客户端提交的待校验密码明文
     */
    private final String challenge;

    /**
     * 客户端用当前时间窗秘钥对challenge的SHA-256签名
     */
    private final String signature;

    /**
     * 认证请求构造器
     *
     * @param username   用户名
     * @param challenge  待校验密码明文
     * @param signature 动态秘钥签名
     */
    public JwtAuthenticationToken(String username, String challenge, String signature) {
        super(null);
        this.username = username;
        this.challenge = challenge;
        this.signature = signature;
        setAuthenticated(false);
    }

    /**
     * 认证成功构造器
     *
     * @param username   用户名
     * @param authorities 权限集合
     */
    public JwtAuthenticationToken(String username, Collection<? extends GrantedAuthority> authorities) {
        super(authorities);
        this.username = username;
        this.challenge = null;
        this.signature = null;
        setAuthenticated(true);
    }

    /**
     * 获取凭证
     *
     * @return 凭证（此处返回challenge）
     */
    @Override
    public Object getCredentials() {
        return challenge;
    }

    /**
     * 获取主体
     *
     * @return 用户名
     */
    @Override
    public Object getPrincipal() {
        return username;
    }

    /**
     * 获取用户名
     *
     * @return 用户名
     */
    public String getUsername() {
        return username;
    }

    /**
     * 获取挑战值
     *
     * @return challenge
     */
    public String getChallenge() {
        return challenge;
    }

    /**
     * 获取签名
     *
     * @return signature
     */
    public String getSignature() {
        return signature;
    }
}
