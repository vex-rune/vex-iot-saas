package com.vex.iot.domain.identity.model;

import com.vex.iot.common.model.BaseEntity;
import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.NoArgsConstructor;

/// **租户 <-> 账号 多对多关系表**。
///
/// <p>一个账号可被授权到多个租户(同时存在多个租户下可见);一个租户可包含多个账号。
///
/// <p>设计要点:
/// <ul>
///   <li>联合主键 {@code (tenantId, userId)} — 同一账号在同租户内只保留一行;</li>
///   <li>{@link #enabled} — 该账号在此租户下的启用开关(默认 true);
///       由管理员接口 {@code PUT /api/admin/accounts/{id}/enabled} 维护。</li>
///   <li>{@code state} — 软删标记,见 {@link BaseEntity#markDeleted}。
///       管理员接口 {@code DELETE /api/admin/accounts/{id}} 只软删中间表关联行(state=-1),
///       不动账号本体。</li>
///   <li>审计字段(创建/更新人 + 时间)来自 {@link BaseEntity}。</li>
/// </ul>
///
/// @author Vex
/// @since 1.0
@EqualsAndHashCode(callSuper = true)
@Data
@NoArgsConstructor
@AllArgsConstructor
@Entity
@IdClass(SysTenantAccountEntityId.class)
@Table(name = "sys_tenant_account")
public class SysTenantAccountEntity extends BaseEntity {

    /**
     * 租户 ID — 既是归属租户
     * 也是联合主键的一部分。
     */
    @Id
    @Column(name = "tenant_id", length = 64, nullable = false)
    private String tenantId;

    /**
     * 账号 ID — 联合主键的另一部分。
     */
    @Id
    @Column(name = "user_id", length = 64, nullable = false)
    private String userId;

    /**
     * 该账号在此租户下的启用开关 — 默认 true。
     *
     * <p>仅约束"账号在当前租户下是否可用";账号本体的 {@code AccountEntity.enabled} 不受此影响。</p>
     */
    @Column(name = "enabled", nullable = false)
    private Boolean enabled = Boolean.TRUE;

}