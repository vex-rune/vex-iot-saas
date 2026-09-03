package com.vex.iot.api.http;

import com.vex.iot.app.AuthApp;
import com.vex.iot.app.auth.model.CurrentUserResponse;
import com.vex.iot.app.auth.model.KeyInfoResponse;
import com.vex.iot.app.auth.model.LoginType;
import com.vex.iot.app.auth.model.TokenPairResp;
import com.vex.iot.common.model.CurrentUser;
import com.vex.iot.common.response.Response;
import com.vex.iot.common.util.UserContext;
import com.vex.iot.domain.audit.annotation.AuditLog;
import com.vex.iot.domain.identity.model.TenantEntity;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * 认证
 *
 * <p>负责处理认证相关的HTTP请求，仅包含请求参数接收和结果转换。
 */
@Slf4j
@RestController
@RequiredArgsConstructor
public class AuthApi {

    /**
     * 认证服务
     */
    private final AuthApp authServer;

    /**
     * 登录 / 换发 token 统一端点。
     */
    @AuditLog(action = "LOGIN", resourceType = "user")
    @PostMapping("/api/auth/login")
    public Response<TokenPairResp> login(@Valid @RequestBody LoginReq req) {
        return Response.ok(authServer.login(
                req.loginType(),
                req.username(),
                req.challenge(),
                req.signature(),
                req.refreshToken(),
                req.targetTenantId()));
    }

    /**
     * 密钥信息
     */
    @GetMapping("/api/auth/key-info")
    public Response<KeyInfoResponse> keyInfo(@RequestParam @NotBlank String username) {
        return Response.ok(authServer.getKeyInfo(username));
    }

    /**
     * 当前用户
     */
    @GetMapping("/api/auth/me")
    public Response<CurrentUserResponse> me() {
        return Response.ok(authServer.getCurrentUser());
    }

    /**
     * 当前账号可切换的租户列表 — 用于右上角"切换租户"弹框。
     */
    @GetMapping("/api/auth/tenants")
    public Response<List<AvailableTenantResp>> availableTenants() {
        CurrentUser cu = UserContext.current().orElse(null);
        if (cu == null || cu.userId() == null || cu.userId().isBlank()) {
            return Response.ok(List.of());
        }

        List<TenantEntity> tenants = authServer.findTenantByUser(cu.userId());


        List<AvailableTenantResp> resp = tenants.stream()
                .filter(t -> !t.isDeleted() && !t.isDeleted())
                .map(t -> new AvailableTenantResp(
                        t.getId(),
                        t.getCode(),
                        t.getName(),
                        cu.tenantId() != null && cu.tenantId().equals(t.getId())))
                .toList();
        return Response.ok(resp);
    }

    /**
     * 登出
     */
    @AuditLog(action = "LOGOUT", resourceType = "user")
    @PostMapping("/api/auth/logout")
    public Response<Void> logout() {
        return Response.ok();
    }

    /**
     * 登录请求(同时支持切换租户 / 续命)。
     *
     * <p>按 {@link #loginType} 路由:
     * <ul>
     *   <li>{@code ADMIN}   — 走 {@code AdminAuthenticationProvider};</li>
     *   <li>{@code USER}    — 走 {@code UserAuthenticationProvider};</li>
     *   <li>{@code REFRESH} — 走 {@code UserRefreshTokenAuthenticationProvider},
     *       用 {@link #refreshToken} 换发新 token,带 {@link #targetTenantId} 时切换租户。</li>
     * </ul>
     *
     * <p>字段填写约定:
     * <table>
     *   <tr><th>字段</th><th>ADMIN</th><th>USER</th><th>REFRESH</th></tr>
     *   <tr><td>username</td><td>必填</td><td>必填</td><td>可空</td></tr>
     *   <tr><td>challenge</td><td>占位</td><td>密码明文</td><td>占位</td></tr>
     *   <tr><td>signature</td><td>动态码</td><td>占位</td><td>占位</td></tr>
     *   <tr><td>refreshToken</td><td>可空</td><td>可空</td><td>必填</td></tr>
     *   <tr><td>targetTenantId</td><td>可空</td><td>可空</td><td>续命=空;切换=目标租户</td></tr>
     * </table>
     */
    public record LoginReq(
            String username,
            @NotNull LoginType loginType,
            @NotBlank String challenge,
            @NotBlank String signature,
            String refreshToken,
            String targetTenantId
    ) {
    }

    public record AvailableTenantResp(
            String id,
            String code,
            String name,
            boolean current
    ) {
    }
}