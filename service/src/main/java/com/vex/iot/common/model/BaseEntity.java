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
public abstract class BaseEntity {

    public static final String DEFAULT_TENANT_ID = "0";
    public static final String SYSTEM_USER_ID = "system";

    /**
     * 创建时间(UTC)
     */
    private Instant createdAt;
    private String createId;
    /**
     * 最后一次更新时间(UTC)
     */
    private Instant updatedAt;
    private String updateId;

    /**
     * 0=正常, -1=软删除。
     */
    @Column(name = "state")
    private Integer state;

    /**
     * 初始化为新建态:createdAt/updatedAt = now(UTC), createId/updateId = operator, state=0。
     */
    public void stampCreated(String operatorId, Instant now) {
        this.createdAt = now;
        this.updatedAt = now;
        this.createId = operatorId;
        this.updateId = operatorId;
        this.state = DataState.NORMAL;
    }

    /**
     * 刷新为更新态:updatedAt = now(UTC), updateId = operator, 不动 createdAt/createId。
     */
    public void stampUpdated(String operatorId, Instant now) {
        this.updatedAt = now;
        this.updateId = operatorId;
        if (this.state == null) this.state = DataState.NORMAL;
    }

    /**
     * 标记软删除:state=-1, 记录删除操作者。
     */
    public void markDeleted(String operatorId, Instant now) {
        this.state = DataState.DELETED;
        this.updatedAt = now;
        this.updateId = operatorId;
    }

    public boolean isDeleted() {
        return state != null && state == DataState.DELETED;
    }
}