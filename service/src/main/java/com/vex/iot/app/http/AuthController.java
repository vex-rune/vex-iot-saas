package com.vex.iot.app.http;

import com.vex.iot.app.http.model.CurrentUserResponse;
import com.vex.iot.app.http.model.KeyInfoResponse;
import com.vex.iot.app.http.model.TokenPairResp;
import com.vex.iot.app.http.model.TokenRefreshReq;
import com.vex.iot.domain.audit.annotation.AuditLog;
import com.vex.iot.common.response.Response;
import com.vex.iot.domain.auth.AuthServer;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.*;

/**
 * 认证
 *
 * <p>负责处理认证相关的HTTP请求，仅包含请求参数接收和结果转换。
 */
@Slf4j
@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    /**
     * 登录类型
     *
     * <p>用于区分管理员动态码登录与普通用户账密登录。
     * 前端必须显式传值，避免仅凭用户名模糊分流带来的歧义。
     */
    public enum LoginType {
        /** 管理员动态码登录（用户名=admin + 6 位 TOTP 动态码） */
        ADMIN,
        /** 普通用户账密登录（用户名 + 密码） */
        USER
    }

    /**
     * 认证服务
     */
    private final AuthServer authServer;

    /**
     * 登录请求
     *
     * @param username   用户名
     * @param loginType  登录类型：ADMIN 走 JwtAuthenticationToken + 动态码；USER 走 UsernamePasswordAuthenticationToken + 账密
     * @param challenge  USER 类型=密码明文；ADMIN 类型=任意占位（后端忽略）
     * @param signature ADMIN 类型=动态码；USER 类型=任意占位（后端忽略）
     */
    public record LoginReq(
        @NotBlank String username,
        @NotNull   LoginType loginType,
        @NotBlank String challenge,
        @NotBlank String signature
    ) {}

    /**
     * 登录
     *
     * @param req 登录请求
     * @return 登录响应（包含业务令牌和刷新令牌）
     */
    @AuditLog(action = "LOGIN", resourceType = "user")
    @PostMapping("/login")
    public Response<TokenPairResp> login(@Valid @RequestBody LoginReq req) {
        return Response.ok(authServer.login(req.loginType(), req.username(), req.challenge(), req.signature()));
    }

    /**
     * 密钥信息
     *
     * @param username 用户名
     * @return 密钥信息
     */
    @GetMapping("/key-info")
    public Response<KeyInfoResponse> keyInfo(@RequestParam @NotBlank String username) {
        return Response.ok(authServer.getKeyInfo(username));
    }

    /**
     * 当前用户
     *
     * @return 当前用户信息
     */
    @GetMapping("/me")
    public Response<CurrentUserResponse> me() {
        return Response.ok(authServer.getCurrentUser());
    }

    /**
     * 刷新Token
     *
     * @param req 刷新请求（包含刷新令牌）
     * @return 新的业务令牌和刷新令牌
     */
    @PostMapping("/refresh")
    public Response<TokenPairResp> refresh(@Valid @RequestBody TokenRefreshReq req) {
        return Response.ok(authServer.refreshToken(req.refreshToken()));
    }

    /**
     * 登出
     *
     * @return 操作结果
     */
    @AuditLog(action = "LOGOUT", resourceType = "user")
    @PostMapping("/logout")
    public Response<Void> logout() {
        return Response.ok();
    }
}
