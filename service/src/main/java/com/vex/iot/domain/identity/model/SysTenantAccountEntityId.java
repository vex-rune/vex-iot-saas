package com.vex.iot.domain.identity.model;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.io.Serializable;
import java.util.Objects;

/**
 * {@link SysTenantAccountEntity} 的复合主键。
 *
 * <p>对应实体中标注了 {@link jakarta.persistence.Id} 的两个字段：
 * <ul>
 *   <li>{@code tenantId} — 租户 ID；</li>
 *   <li>{@code userId} — 账号 ID。</li>
 * </ul>
 *
 * <p>JPA 规范要求复合主键类必须是 {@link Serializable}，
 * 并正确实现 {@link #equals(Object)} 与 {@link #hashCode()}。
 *
 * @author Vex
 * @since 1.0
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class SysTenantAccountEntityId implements Serializable {

    private static final long serialVersionUID = 1L;

    /**
     * 租户 ID（与实体 tenantId 字段对应）。
     */
    private String tenantId;

    /**
     * 账号 ID（与实体 userId 字段对应）。
     */
    private String userId;

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (!(o instanceof SysTenantAccountEntityId that)) return false;
        return Objects.equals(tenantId, that.tenantId)
                && Objects.equals(userId, that.userId);
    }

    @Override
    public int hashCode() {
        return Objects.hash(tenantId, userId);
    }
}