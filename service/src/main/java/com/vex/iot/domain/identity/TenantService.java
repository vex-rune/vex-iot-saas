package com.vex.iot.domain.identity;

import com.vex.iot.common.model.TenantBaseEntity;
import com.vex.iot.common.queries.QueriesPageRequest;
import com.vex.iot.common.queries.jpa.JpaQueriesExecutor;
import com.vex.iot.common.util.IdGenerator;
import com.vex.iot.common.util.UserContext;
import com.vex.iot.domain.identity.model.SysTenantAccountEntity;
import com.vex.iot.domain.identity.model.TenantEntity;
import com.vex.iot.domain.identity.repository.AccountRepository;
import com.vex.iot.domain.identity.repository.SysTenantAccountRepository;
import com.vex.iot.domain.identity.repository.TenantRepository;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

/**
 * 租户应用服务 — 维护 {@code sys_tenant} 主数据。
 *
 * <p>该表是系统中"租户维度的元数据表"，与每个业务实体上的 {@code BaseEntity.tenantId}
 * 协同：{@link TenantBaseEntity#getTenantId()} 是归属维度，本表提供"租户档案"。
 *
 * <p>{@link #isTenantUsable(String)} 是登录拦截 / SSE 路由 共用的可用性判断。
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class TenantService {

    private final TenantRepository tenantRepository;
    private final SysTenantAccountRepository linkRepository;
    private final AccountRepository accountRepository;

    @PersistenceContext
    private EntityManager entityManager;

    /**
     * 创建或更新租户（用 {@link TenantEntity#getId()} 区分新建/更新；null/空视为新建）。
     */
    public TenantEntity save(TenantEntity tenant) {
        Instant now = Instant.now();
        String operator = UserContext.username().orElse(TenantBaseEntity.SYSTEM_USER_ID);
        if (tenant.getId() == null || tenant.getId().isBlank()) {
            tenant.setId(IdGenerator.snowId());
            tenant.stampCreated(operator, now);
        } else {
            tenant.stampUpdated(operator, now);
        }
        return tenantRepository.save(tenant);
    }

    /**
     * 软删
     */
    public void delete(String id) {
        TenantEntity exist = tenantRepository.findById(id).orElse(null);
        if (exist != null) {
            String operator = UserContext.username().orElse(TenantBaseEntity.SYSTEM_USER_ID);
            exist.markDeleted(operator, Instant.now());
            tenantRepository.save(exist);
        }
    }

    /**
     * 直接拿
     */
    public Optional<TenantEntity> findById(String id) {
        return tenantRepository.findById(id);
    }

    /**
     * 按短代码查
     */
    public Optional<TenantEntity> findByCode(String code) {
        if (code == null || code.isBlank()) return Optional.empty();
        return tenantRepository.findByCode(code);
    }

    /**
     * 租户是否可用 — 用于登录拦截、SSE 路由兜底过滤等。
     */
    public boolean isTenantUsable(String tenantId) {
        if (tenantId == null || tenantId.isBlank()) return false;
        // 系统默认租户（"0"）永远可用
        if (TenantBaseEntity.DEFAULT_TENANT_ID.equals(tenantId)) return true;
        return tenantRepository.findById(tenantId)
                .map(t -> !t.isDeleted() && t.isEnabled())
                .orElse(false);
    }

    public List<TenantEntity> query(QueriesPageRequest req) {
        return JpaQueriesExecutor.of(TenantEntity.class, entityManager).page(req);
    }

    public long count(QueriesPageRequest req) {
        return JpaQueriesExecutor.of(TenantEntity.class, entityManager).count(req != null ? req.getPredicate() : null);
    }

    // ==================== 租户 ↔ 账号 多对多 ====================

    /// 关联: 给某租户绑定一个账号(不可重复,UPSERT 语义)
    public void linkAccount(String tenantId, String userId) {
        if (tenantId == null || tenantId.isBlank() || userId == null || userId.isBlank()) {
            throw new IllegalArgumentException("tenantId / userId 不能为空");
        }
        if (linkRepository.existsByTenantIdAndUserId(tenantId, userId)) {
            log.debug("账号已关联,跳过 tenantId={} userId={}", tenantId, userId);
            return;
        }
        Instant now = Instant.now();
        String operator = UserContext.username().orElse(TenantBaseEntity.SYSTEM_USER_ID);
        SysTenantAccountEntity link = new SysTenantAccountEntity();
        link.setTenantId(tenantId);
        link.setUserId(userId);
        link.stampCreated(operator, now);
        linkRepository.save(link);
        log.info("账号关联已建立 tenantId={} userId={}", tenantId, userId);
    }

    /// 解除关联
    public void unlinkAccount(String tenantId, String userId) {
        long count = linkRepository.deleteByTenantIdAndUserId(tenantId, userId);
        if (count > 0) {
            log.info("账号关联已解除 tenantId={} userId={}", tenantId, userId);
        }
    }

    /// 批量绑定 — 一次 N 个,便于"详情抽屉勾选后"的一次提交
    public void linkAccounts(String tenantId, List<String> userIds) {
        if (userIds == null || userIds.isEmpty()) return;
        for (String uid : userIds) linkAccount(tenantId, uid);
    }

    /// 批量解除
    public void unlinkAccounts(String tenantId, List<String> userIds) {
        if (userIds == null || userIds.isEmpty()) return;
        for (String uid : userIds) unlinkAccount(tenantId, uid);
    }


    public List<TenantEntity> listTenantsOfAccount(String userId) {
        if (userId == null || userId.isBlank()) return List.of();
        // 1. 关联表里所有 tenantId
        List<String> tenantIds = linkRepository.findByUserId(userId).stream()
                .map(SysTenantAccountEntity::getTenantId)
                .toList();
        if (tenantIds.isEmpty()) return List.of();
        // 2. 一次拉全
        return tenantRepository.findAllById(tenantIds);
    }
}