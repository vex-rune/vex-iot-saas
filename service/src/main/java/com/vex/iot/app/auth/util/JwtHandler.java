package com.vex.iot.app.auth.util;

import com.vex.iot.app.auth.config.SecurityProperties;
import com.vex.iot.app.auth.exception.TokenExpiredException;
import com.vex.iot.app.auth.exception.TokenInvalidException;
import com.vex.iot.app.auth.model.LoginUser;
import com.vex.iot.common.config.IEnum;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.ExpiredJwtException;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import io.jsonwebtoken.security.SignatureException;
import lombok.Getter;
import org.springframework.stereotype.Component;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.util.Date;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

/**
 * JWT处理器
 */
@Component
public class JwtHandler {

    private static final int MIN_SECRET_BYTES = 32;
    private final SecurityProperties props;
    private final SecretKey key;

    public JwtHandler(SecurityProperties props) {
        this.props = props;
        String secret = props.secret();
        if (secret == null || secret.isBlank()) {
            throw new IllegalStateException(
                    "JWT secret 未配置: 生产必须通过环境变量 JWT_SECRET 注入至少 32 字节密钥");
        }
        byte[] bytes = secret.getBytes(StandardCharsets.UTF_8);
        if (bytes.length < MIN_SECRET_BYTES) {
            throw new IllegalStateException(
                    "JWT secret 长度不足 " + MIN_SECRET_BYTES + " 字节,实际 " + bytes.length + " 字节");
        }
        this.key = Keys.hmacShaKeyFor(bytes);
    }

    /**
     * 生成 Token
     *
     * @param user      登录用户
     * @param tokenType Token 类型
     * @return JWT Token
     */
    public String generate(LoginUser user, TokenType tokenType) {
        int expireSeconds = tokenType == TokenType.ACCESS
                ? TokenExpire.ACCESS.getSeconds()
                : TokenExpire.REFRESH.getSeconds();

        Date now = new Date();
        Date expire = new Date(now.getTime() + expireSeconds * 1000L);
        return Jwts.builder()
                .subject(user.userId())
                .claim("type", tokenType.name())
                .claim("username", user.username())
                .claim("tenantId", user.tenantId())
                .claim("roles", user.roles())
                .issuedAt(now)
                .expiration(expire)
                .signWith(key)
                .compact();
    }

    public LoginUser parse(String token) {
        return parse(token, null);
    }

    /**
     * 解析 Token
     *
     * @param token     JWT Token
     * @param tokenType 期望的 Token 类型，null 表示不校验类型
     * @return 登录用户
     */
    public LoginUser parse(String token, TokenType tokenType) {
        try {
            Claims claims = Jwts.parser().verifyWith(key).build()
                    .parseSignedClaims(token).getPayload();

            // 校验 Token 类型
            if (tokenType != null) {
                String type = claims.get("type", String.class);
                if (!tokenType.name().equals(type)) {
                    throw new TokenInvalidException("Token 类型不匹配");
                }
            }

            List<String> roleList = claims.get("roles", List.class);
            Set<String> roles = roleList == null ? Set.of() : new HashSet<>(roleList);
            return LoginUser.builder()
                    .userId(claims.getSubject())
                    .username(claims.get("username", String.class))
                    .tenantId(claims.get("tenantId", String.class))
                    .roles(roles).permissions(Set.of()).build();
        } catch (ExpiredJwtException ex) {
            throw new TokenExpiredException();
        } catch (SignatureException ex) {
            throw new TokenInvalidException("Token 签名无效");
        } catch (JwtException ex) {
            throw new TokenInvalidException("Token 格式错误");
        }
    }

    public String resolveToken(String authorization) {
        if (authorization == null) return null;
        String prefix = props.prefix();
        if (prefix != null && !prefix.isBlank() && authorization.startsWith(prefix))
            return authorization.substring(prefix.length()).trim();
        return authorization.trim();
    }

    public enum TokenType implements IEnum {
        /**
         * 业务令牌
         */
        ACCESS,
        /**
         * 刷新令牌
         */
        REFRESH;

        @Override
        public String displayName() {
            return name();
        }
    }

    /**
     * Token 有效期配置（秒）
     */
    @Getter
    public enum TokenExpire implements IEnum {
        /**
         * 业务令牌有效期：24小时
         */
        ACCESS(24 * 60 * 60),
        /**
         * 刷新令牌有效期：15天
         */
        REFRESH(15 * 24 * 60 * 60);

        private final int seconds;

        TokenExpire(int seconds) {
            this.seconds = seconds;
        }

        @Override
        public String displayName() {
            return name();
        }
    }
}
