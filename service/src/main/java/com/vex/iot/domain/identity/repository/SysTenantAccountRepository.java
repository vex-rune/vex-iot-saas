package com.vex.iot.domain.identity.repository;

import com.vex.iot.domain.identity.model.SysTenantAccountEntity;
import com.vex.iot.domain.identity.model.SysTenantAccountEntityId;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface SysTenantAccountRepository
        extends JpaRepository<SysTenantAccountEntity, SysTenantAccountEntityId> {

    /// 某租户下的所有关联账号
    List<SysTenantAccountEntity> findByTenantId(String tenantId);

    /// 某账号下的所有关联租户
    List<SysTenantAccountEntity> findByUserId(String userId);

    /// 联合删除(物理)
    long deleteByTenantIdAndUserId(String tenantId, String userId);

    /// 校验存在(任意 state,包括已软删)
    boolean existsByTenantIdAndUserId(String tenantId, String userId);

    /// 按主键查 + state != DELETED — 用于启停/软删接口的"找活着的行"
    Optional<SysTenantAccountEntity> findByTenantIdAndUserIdAndStateNot(String tenantId, String userId, Integer state);

    /// 某账号是否存在至少一行 (state != DELETED AND enabled = true) — 用于登录校验
    boolean existsByUserIdAndStateNotAndEnabledTrue(String userId, Integer state);

    /// 某账号在指定租户下是否存在 (state != DELETED AND enabled = true) — 用于切换租户校验
    boolean existsByUserIdAndTenantIdAndStateNotAndEnabledTrue(String userId, String tenantId, Integer state);

    /// 某账号所有 (state != DELETED AND enabled = true) 的关联行 — 用于渲染切换租户弹框
    List<SysTenantAccountEntity> findByUserIdAndStateNotAndEnabledTrue(String userId, Integer state);
}