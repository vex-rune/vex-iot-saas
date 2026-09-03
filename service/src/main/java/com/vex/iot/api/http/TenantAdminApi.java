package com.vex.iot.api.http;

import com.vex.iot.common.queries.QueriesPageRequest;
import com.vex.iot.common.response.Response;
import com.vex.iot.domain.audit.annotation.AuditLog;
import com.vex.iot.domain.identity.AccountService;
import com.vex.iot.domain.identity.TenantService;
import com.vex.iot.domain.identity.model.AccountEntity;
import com.vex.iot.domain.identity.model.TenantEntity;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/// 租户管理（管理员侧）— 仅 {@code SUPER_ADMIN} 可调用。
///
/// <p>范围：
/// <ul>
///   <li>租户档案的 CRUD（含启停）；</li>
///   <li>系统默认租户 ({@code tenantId = "0"}) 不允许删除；</li>
///   <li>租户禁用后，{@code AuthApp.login} 会拦截该租户下账号登录（已实现）。</li>
/// </ul>
@RestController
@RequiredArgsConstructor
@RequestMapping("/api/admin/tenants")
@PreAuthorize("hasRole('SUPER_ADMIN')")
public class TenantAdminApi {

    /**
     * 系统默认租户 — 永不被删除 / 永不被禁用
     */
    private static final String DEFAULT_TENANT_ID = "0";

    private final TenantService tenantService;
    private final AccountService accountService;

    /**
     * 租户-条件查询
     */
    @PostMapping("/query")
    public Response<List<TenantEntity>> query(@Valid @RequestBody QueriesPageRequest req) {
        return Response.ok(tenantService.query(req));
    }

    /**
     * 租户-数量
     */
    @PostMapping("/count")
    public Response<Long> count(@Valid @RequestBody QueriesPageRequest req) {
        return Response.ok(tenantService.count(req));
    }

    /**
     * 租户-详情
     */
    @GetMapping("/{id}")
    public Response<TenantEntity> get(@PathVariable String id) {
        return tenantService.findById(id)
                .map(Response::ok)
                .orElseGet(() -> Response.fail("not_found", "租户不存在: " + id));
    }

    /**
     * 租户-按短代码查
     */
    @GetMapping("/by-code/{code}")
    public Response<TenantEntity> getByCode(@PathVariable String code) {
        return tenantService.findByCode(code)
                .map(Response::ok)
                .orElseGet(() -> Response.fail("not_found", "租户不存在: " + code));
    }

    /**
     * 租户-创建
     */
    @AuditLog(action = "TENANT_CREATE", resourceType = "tenant")
    @PostMapping
    public Response<TenantEntity> create(@Valid @RequestBody UpsertReq req) {
        TenantEntity t = new TenantEntity();
        t.setCode(req.code());
        t.setName(req.name());
        t.setDescription(req.description());
        t.setEnabled(req.enabled() == null ? true : req.enabled());
        return Response.ok(tenantService.save(t));
    }

    /**
     * 租户-更新（含启停）
     */
    @AuditLog(action = "TENANT_UPDATE", resourceType = "tenant")
    @PutMapping("/{id}")
    public Response<TenantEntity> update(@PathVariable String id, @Valid @RequestBody UpsertReq req) {
        TenantEntity exist = tenantService.findById(id).orElse(null);
        if (exist == null) {
            return Response.fail("not_found", "租户不存在: " + id);
        }
        exist.setName(req.name() == null ? exist.getName() : req.name());
        exist.setDescription(req.description() == null ? exist.getDescription() : req.description());
        if (req.enabled() != null) {
            if (DEFAULT_TENANT_ID.equals(exist.getId()) && !req.enabled()) {
                return Response.fail("forbidden", "默认租户不能被禁用");
            }
            exist.setEnabled(req.enabled());
        }
        return Response.ok(tenantService.save(exist));
    }

    /**
     * 租户-软删
     */
    @AuditLog(action = "TENANT_DELETE", resourceType = "tenant")
    @DeleteMapping("/{id}")
    public Response<Void> delete(@PathVariable String id) {
        if (DEFAULT_TENANT_ID.equals(id)) {
            return Response.fail("forbidden", "默认租户不能被删除");
        }
        tenantService.delete(id);
        return Response.ok();
    }

    // ==================== 详情 + 多对多关系 ====================

    /**
     * 租户-详情(带关联账号)
     */
    @GetMapping("/{id}/detail")
    public Response<DetailResp> detail(@PathVariable String id) {
        TenantEntity tenant = tenantService.findById(id).orElse(null);
        if (tenant == null) {
            return Response.fail("not_found", "租户不存在: " + id);
        }
        return Response.ok(new DetailResp(tenant, accountService.listAccountsOfTenant(id)));
    }

    /**
     * 租户-批量绑定账号
     */
    @AuditLog(action = "TENANT_LINK_ACCOUNTS", resourceType = "tenant")
    @PostMapping("/{id}/accounts/link")
    public Response<Void> linkAccounts(@PathVariable String id, @Valid @RequestBody LinkReq req) {
        tenantService.linkAccounts(id, req.userIds());
        return Response.ok();
    }

    /**
     * 租户-批量解除绑定账号
     */
    @AuditLog(action = "TENANT_UNLINK_ACCOUNTS", resourceType = "tenant")
    @PostMapping("/{id}/accounts/unlink")
    public Response<Void> unlinkAccounts(@PathVariable String id, @Valid @RequestBody LinkReq req) {
        tenantService.unlinkAccounts(id, req.userIds());
        return Response.ok();
    }

    /// 租户详情 + 关联账号列表
    public record DetailResp(TenantEntity tenant, List<AccountEntity> accounts) {
    }

    /// 关联/解除(批量)— DTO
    public record LinkReq(@NotEmpty List<@NotBlank String> userIds) {
    }

    public record UpsertReq(
            @NotBlank @Size(max = 32) String code,
            @Size(max = 128) String name,
            @Size(max = 512) String description,
            Boolean enabled
    ) {
    }
}