package com.vex.iot.api.http;

import com.vex.iot.common.model.BaseEntity;
import com.vex.iot.common.queries.QueriesPageRequest;
import com.vex.iot.common.response.Response;
import com.vex.iot.domain.audit.annotation.AuditLog;
import com.vex.iot.domain.identity.AccountService;
import com.vex.iot.domain.identity.TenantService;
import com.vex.iot.domain.identity.model.AccountEntity;
import com.vex.iot.domain.identity.model.TenantEntity;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Set;

/// 账号管理(管理员侧) — 仅 {@code SUPER_ADMIN} 可调用。
///
/// <p>{@code @PreAuthorize("hasRole('SUPER_ADMIN')")} 把关;多租户守卫由 {@link AccountService} 内部保证。
/// 全部写操作走 {@link com.vex.iot.domain.audit.annotation.AuditLog} 记录。
@RestController
@RequiredArgsConstructor
@RequestMapping("/api/admin/accounts")
@PreAuthorize("hasRole('SUPER_ADMIN')")
public class AccountAdminApi {

    /**
     * 请求头:租户 ID。缺失时回退到默认租户 {@link BaseEntity#DEFAULT_TENANT_ID}。
     */
    public static final String HEADER_TENANT_ID = "X-Tenant-Id";

    private final AccountService accountService;
    private final TenantService tenantService;

    /**
     * 账号-条件查询(Spring Data Example + Pageable)
     */
    @PostMapping("/query")
    public Response<List<AccountEntity>> query(QueriesPageRequest request) {
        return Response.ok(accountService.query(request));
    }

    /**
     * 账号-数量
     */
    @PostMapping("/count")
    public Response<Long> count(@Valid @RequestBody QueriesPageRequest req) {
        return Response.ok(accountService.count(req));
    }

    @GetMapping("/{id}")
    public Response<AccountDetailResp> get(@PathVariable String id) {
        AccountEntity a = accountService.findById(id);
        if (a == null) {
            return Response.fail("not_found", "用户不存在: " + id);
        }
        return Response.ok(new AccountDetailResp(a, tenantService.listTenantsOfAccount(id)));
    }

    /**
     * 账号-创建 — 租户授权不再由入参选择,改在租户详情维护关系
     */
    @AuditLog(action = "ACCOUNT_CREATE", resourceType = "account")
    @PostMapping
    public Response<AccountEntity> create(@Valid @RequestBody CreateReq req) {
        return Response.ok(accountService.createAccount(
                req.tenantId(), req.username(), req.displayName(),
                req.password(), req.roles()));
    }

    /**
     * 账号-启停(限定租户内) — 直接维护中间表 {@code sys_tenant_account.enabled} 字段;
     * 账号本体 {@link AccountEntity} 不动。租户 ID 从请求头 {@value #HEADER_TENANT_ID} 取,
     * 缺失则回退到默认租户 {@link BaseEntity#DEFAULT_TENANT_ID}。
     */
    @AuditLog(action = "ACCOUNT_TOGGLE_ENABLED", resourceType = "account")
    @PutMapping("/{id}/enabled")
    public Response<Void> setEnabled(@PathVariable String id,
                                     @RequestBody ToggleEnabledReq body,
                                     HttpServletRequest request) {
        String tenantId = resolveTenantId(request);
        accountService.setEnabled(tenantId, id, body.enabled());
        return Response.ok();
    }

    /**
     * 账号-软删(限定租户内) — 仅软删中间表关联行(state=-1),不动账号本体。
     * 租户 ID 从请求头 {@value #HEADER_TENANT_ID} 取,缺失则回退到默认租户。
     */
    @AuditLog(action = "ACCOUNT_DELETE", resourceType = "account")
    @DeleteMapping("/{id}")
    public Response<Void> delete(@PathVariable String id, HttpServletRequest request) {
        String tenantId = resolveTenantId(request);
        accountService.deleteAccount(tenantId, id);
        return Response.ok();
    }

    /**
     * 从请求头解析租户 ID — 缺失/空白时回退到默认租户。
     */
    private String resolveTenantId(HttpServletRequest request) {
        String tenantId = request.getHeader(HEADER_TENANT_ID);
        if (tenantId == null || tenantId.isBlank()) {
            return BaseEntity.DEFAULT_TENANT_ID;
        }
        return tenantId.trim();
    }

    /**
     * 账号-详情(按 id) — 含主租户 + 关联租户列表
     */
    public record AccountDetailResp(AccountEntity account, List<TenantEntity> linkedTenants) {
    }

    public record CreateReq(
            @NotBlank String tenantId,
            @NotBlank @Size(max = 64) String username,
            @Size(max = 128) String displayName,
            @NotBlank @Size(min = 6, max = 64) String password,
            Set<String> roles
    ) {
    }

    public record ToggleEnabledReq(boolean enabled) {
    }
}