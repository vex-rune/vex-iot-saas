package com.vex.iot.domain.identity;

import com.vex.iot.common.constants.DataState;
import com.vex.iot.common.constants.RoleConstants;
import com.vex.iot.common.exception.BusinessExceptions.NotFoundException;
import com.vex.iot.common.model.TenantBaseEntity;
import com.vex.iot.common.queries.QueriesPageRequest;
import com.vex.iot.common.queries.jpa.JpaQueriesExecutor;
import com.vex.iot.common.security.PasswordHasher;
import com.vex.iot.common.util.UserContext;
import com.vex.iot.domain.data.model.DataEntity;
import com.vex.iot.domain.identity.exception.InvalidCredentialException;
import com.vex.iot.domain.identity.model.AccountEntity;
import com.vex.iot.domain.identity.model.SysTenantAccountEntity;
import com.vex.iot.domain.identity.repository.AccountRepository;
import com.vex.iot.domain.identity.repository.SysTenantAccountRepository;
import jakarta.persistence.EntityManager;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.List;
import java.util.Set;

/**
 * 用户服务 — 多租户感知。
 *
 * <p>{@link TenantBaseEntity#getTenantId()} 字段已由 {@link AccountEntity} 继承；
 * 本服务所有"创建/启停/删除"路径都带 {@code tenantId} 参数，避免跨租户误操作。
 * <p>
 * 同时检查"账号启用 + 租户启用 + 租户未删除"。
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class AccountService {

    private final AccountRepository accountRepository;
    private final TenantService tenantService;
    private final SysTenantAccountRepository linkRepository;
    private final EntityManager entityManager;

    public AccountEntity loadByUsername(String username) {
        return accountRepository.findByUsername(username)
                .orElseThrow(() -> new UsernameNotFoundException("用户不存在"));
    }

    /// 按 id 查 — 不抛异常，找不到返回 null
    public AccountEntity findById(String userId) {
        if (userId == null || userId.isBlank()) return null;
        return accountRepository.findById(userId).orElse(null);
    }

    public boolean isAdmin(AccountEntity user) {
        if (user == null || user.getRoles() == null) return false;
        return user.getRoles().contains(RoleConstants.SUPER_ADMIN);
    }

    public void verifyPassword(AccountEntity user, String password) {
        if (!PasswordHasher.verify(user.getSalt(), password, user.getPasswordHash())) {
            throw new InvalidCredentialException("密码错误");
        }
    }

    public void updateLastLogin(String username) {
        accountRepository.findByUsername(username).ifPresent(user -> {
            Instant now = Instant.now();
            user.setLastLoginAt(now);
            user.stampUpdated(TenantBaseEntity.SYSTEM_USER_ID, now);
            accountRepository.save(user);
        });
    }

    public void changePassword(String username, String newPlain) {
        AccountEntity user = loadByUsername(username);
        String newSalt = PasswordHasher.generateSalt();
        user.setSalt(newSalt);
        user.setPasswordHash(PasswordHasher.hash(newSalt, newPlain));
        Instant now = Instant.now();
        user.stampUpdated(TenantBaseEntity.SYSTEM_USER_ID, now);
        accountRepository.save(user);
        log.info("用户密码已重置 username={}", username);
    }

    // ==================== 多租户 API ====================

    /// 创建账号 — 必须指定 tenantId；租户必须可用
    public AccountEntity createAccount(@Valid @NotNull String tenantId, @Valid @NotNull String username, @Valid @NotNull String displayName,
                                       @Valid @NotNull String plainPassword, @Valid @NotNull Set<String> roles) {
        if (tenantId == null || tenantId.isBlank()) {
            throw new IllegalArgumentException("tenantId 不能为空");
        }
        if (!TenantBaseEntity.DEFAULT_TENANT_ID.equals(tenantId)
                && !tenantService.isTenantUsable(tenantId)) {
            throw new IllegalArgumentException("租户不可用: " + tenantId);
        }
        if (accountRepository.findByUsername(username).isPresent()) {
            throw new IllegalArgumentException("用户名已存在: " + username);
        }
        AccountEntity u = AccountEntity.builder()
                .username(username)
                .displayName(displayName == null ? username : displayName)
                .roles(roles == null ? Set.of() : roles)
                .enabled(true)
                .build();
        String salt = PasswordHasher.generateSalt();
        u.setSalt(salt);
        u.setPasswordHash(PasswordHasher.hash(salt, plainPassword));
        Instant now = Instant.now();
        u.stampCreated(TenantBaseEntity.SYSTEM_USER_ID, now);
        u = accountRepository.save(u);
        log.info("账号已创建 tenantId={} username={}", tenantId, username);
        return u;
    }

    /// 软删 — 限定租户(只软删中间表关联行,不动 AccountEntity 本体)
    public void deleteAccount(String tenantId, String userId) {
        softDeleteLink(tenantId, userId);
    }

    /// 启停账号 — 限定租户(只切换中间表关联行的 enabled,不动 AccountEntity 本体)
    public void setEnabled(String tenantId, String userId, boolean enabled) {
        setEnabledLink(tenantId, userId, enabled);
    }

    // ==================== 中间表(租户 ↔ 账号)启停/软删 ====================

    /**
     * 切换"账号在指定租户下"的启用开关。
     *
     * <p>行为:
     * <ul>
     *   <li>找到中间表 {@code (tenantId, userId)} 这行(state != DELETED);</li>
     *   <li>把 {@code enabled} 字段更新为传入值;</li>
     *   <li>账号本体 {@link AccountEntity} 不动。</li>
     * </ul>
     * 找不到该关联行时抛 {@link NotFoundException}。
     */
    public void setEnabledLink(String tenantId, String userId, boolean enabled) {
        if (tenantId == null || tenantId.isBlank() || userId == null || userId.isBlank()) {
            throw new IllegalArgumentException("tenantId / userId 不能为空");
        }
        SysTenantAccountEntity link = linkRepository
                .findByTenantIdAndUserIdAndStateNot(tenantId, userId, DataState.DELETED)
                .orElseThrow(() -> new NotFoundException(
                        "账号在指定租户下未授权: tenantId=" + tenantId + ", userId=" + userId));
        link.setEnabled(enabled);
        String operator = UserContext.username().orElse(TenantBaseEntity.SYSTEM_USER_ID);
        link.stampUpdated(operator, Instant.now());
        linkRepository.save(link);
        log.info("中间表-启停状态已切换 tenantId={} userId={} enabled={}", tenantId, userId, enabled);
    }

    /**
     * 软删"账号在指定租户下"的关联 — 仅修改中间表行,不动 {@link AccountEntity} 本体。
     *
     * <p>其他租户下该账号的关联行不受影响。</p>
     */
    public void softDeleteLink(String tenantId, String userId) {
        if (tenantId == null || tenantId.isBlank() || userId == null || userId.isBlank()) {
            throw new IllegalArgumentException("tenantId / userId 不能为空");
        }
        SysTenantAccountEntity link = linkRepository
                .findByTenantIdAndUserIdAndStateNot(tenantId, userId, DataState.DELETED)
                .orElse(null);
        if (link == null) {
            log.debug("中间表关联行不存在或已软删,跳过 tenantId={} userId={}", tenantId, userId);
            return;
        }
        String operator = UserContext.username().orElse(TenantBaseEntity.SYSTEM_USER_ID);
        link.markDeleted(operator, Instant.now());
        linkRepository.save(link);
        log.info("中间表-关联行已软删 tenantId={} userId={}", tenantId, userId);
    }

    /**
     * 判断账号是否在至少一个租户下处于"启用且未软删"状态。
     *
     * <p>用于登录校验:账号至少要有一条活的中间表授权行,才允许登录。</p>
     */
    public boolean hasUsableLink(String userId) {
        if (userId == null || userId.isBlank()) return false;
        return linkRepository.existsByUserIdAndStateNotAndEnabledTrue(userId, DataState.DELETED);
    }

    /**
     * 判断账号在指定租户下是否有"启用且未软删"的授权行 — 用于切换租户校验。
     */
    public boolean hasUsableLinkInTenant(String userId, String tenantId) {
        if (userId == null || userId.isBlank() || tenantId == null || tenantId.isBlank()) {
            return false;
        }
        return linkRepository.existsByUserIdAndTenantIdAndStateNotAndEnabledTrue(
                userId, tenantId, DataState.DELETED);
    }

    /**
     * 列出某账号所有可切换的租户(中间表 state=正常 + enabled=true)。
     *
     * <p>调用方再自行过滤掉租户本身不可用(state=-1 / enabled=false)的行,
     * 以确保 UI 上展示给用户的是"真正能切进去"的租户。</p>
     */
    public List<SysTenantAccountEntity> listAvailableLinksOfUser(String userId) {
        if (userId == null || userId.isBlank()) return List.of();
        return linkRepository.findByUserIdAndStateNotAndEnabledTrue(userId, DataState.DELETED);
    }


    public List<AccountEntity> query(QueriesPageRequest request) {
        return JpaQueriesExecutor.of(AccountEntity.class, entityManager).page(request);
    }

    public Long count(@Valid QueriesPageRequest req) {
        return JpaQueriesExecutor.of(DataEntity.class, entityManager).count(req.getPredicate());
    }


    /// 列出某租户下所有关联账号
    public List<AccountEntity> listAccountsOfTenant(String tenantId) {
        if (tenantId == null || tenantId.isBlank()) return List.of();
        // 1. 关联表里的 userId
        List<String> userIds = linkRepository.findByTenantId(tenantId).stream()
                .map(SysTenantAccountEntity::getUserId)
                .toList();
        if (userIds.isEmpty()) return List.of();
        // 2. 一次性拉全,按原始顺序回填
        List<AccountEntity> all = accountRepository.findAllById(userIds);
        // 保持查询语义稳定 — 不强行排序,留给前端按字段排
        return all;
    }
}