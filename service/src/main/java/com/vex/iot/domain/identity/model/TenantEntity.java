package com.vex.iot.domain.identity.model;

import com.vex.iot.common.model.BaseEntity;
import com.vex.iot.common.model.SnowflakeId;
import com.vex.iot.common.model.TenantBaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.NoArgsConstructor;
import lombok.experimental.SuperBuilder;

/// 租户模型 — 系统多租户支持的"根"。
///
/// <p>{@code tenantId} 是所有业务实体（{@link TenantBaseEntity#getTenantId()}）的归属维度；
/// 本实体独立成表是为了将来运营侧做 CRUD / 启停 / 配额。
///
/// <p>字段：
/// <ul>
///   <li>{@link #id} — 租户 ID（雪花算法；与 {@code BaseEntity.tenantId} 字段值空间统一）</li>
///   <li>{@link #code} — 短代码（如 {@code "demo"}），唯一，用于登录与 URL 路径</li>
///   <li>{@link #name} — 显示名</li>
///   <li>{@link #enabled} — 是否启用；禁用后该租户下账号登录与 SSE 推送都会被拦截</li>
///   <li>审计字段来自 {@link TenantBaseEntity}</li>
/// </ul>
///
/// @author Vex
/// @since 1.0
@EqualsAndHashCode(callSuper = true)
@Data
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "sys_tenant")
public class TenantEntity extends BaseEntity {

    /// 租户 ID（雪花算法），与 {@code BaseEntity.tenantId} 字段值空间一致。
    @Id
    @SnowflakeId
    private String id;

    /// 短代码，唯一。
    @Size(max = 32)
    @Column(nullable = false, unique = true, length = 32)
    private String code;

    /// 租户显示名。
    @Size(max = 128)
    @Column(length = 128)
    private String name;

    /// 备注 / 描述。
    @Size(max = 512)
    @Column(length = 512)
    private String description;

    /// 是否启用 — 禁用后所有本租户账号登录将被拒绝（实现见 {@code AuthApp}）。
    @lombok.Builder.Default
    private boolean enabled = true;


}