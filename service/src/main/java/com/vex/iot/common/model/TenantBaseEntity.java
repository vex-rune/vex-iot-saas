package com.vex.iot.common.model;

import com.vex.iot.common.constants.DataState;
import jakarta.persistence.Column;
import jakarta.persistence.EntityListeners;
import jakarta.persistence.MappedSuperclass;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.experimental.SuperBuilder;

import java.time.Instant;

/**
 * 所有持久化实体基类:统一审计字段 + 软删除标记。
 *
 * <p>字段约定:
 * <ul>
 *   <li>createdAt / createId — 创建时间 / 创建者 userId,系统创建时为 {@link #SYSTEM_USER_ID};</li>
 *   <li>updatedAt / updateId — 最后一次更新时间 / 更新者 userId,系统更新时为 {@link #SYSTEM_USER_ID};</li>
 *   <li>state — 数据状态, {@link DataState#NORMAL}=0 正常, {@link DataState#DELETED}=-1 软删除;</li>
 *   <li>tenantId — 归属租户 ID,系统默认租户 {@link #DEFAULT_TENANT_ID}。</li>
 * </ul>
 *
 * <p>时间字段统一为 {@link Instant}(UTC),DB 列类型为 {@code timestamptz}。
 * 子类应使用 {@code @SuperBuilder} 继承 builder,从而支持 {@code tenantId(...)} 等基类字段的链式设置。
 */
@Getter
@Setter
@NoArgsConstructor
@SuperBuilder
@MappedSuperclass
@EntityListeners(SnowflakeIdListener.class)
public abstract class TenantBaseEntity extends BaseEntity {

    public static final String TENANT_ID_FIELD_NAME = "tenantId";
    public static final String DEFAULT_TENANT_ID = "0";
    public static final String SYSTEM_USER_ID = "system";

    /**
     * 归属租户,默认 "0"。
     */
    @Column(length = 64)
    private String tenantId;

    /**
     * 初始化为新建态:createdAt/updatedAt = now(UTC), createId/updateId = operator, state=0, tenantId=DEFAULT。
     */
    @Override
    public void stampCreated(String operatorId, Instant now) {
        super.stampCreated(operatorId, now);
        if (this.tenantId == null || this.tenantId.isBlank()) this.tenantId = DEFAULT_TENANT_ID;
    }
}