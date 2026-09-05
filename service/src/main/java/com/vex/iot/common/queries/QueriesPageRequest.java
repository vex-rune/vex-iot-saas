package com.vex.iot.common.queries;

import com.vex.iot.common.exception.BadRequestException;
import com.vex.iot.common.model.TenantBaseEntity;
import com.vex.iot.common.util.UserContext;
import jakarta.validation.Valid;
import lombok.Getter;
import lombok.Setter;

import java.io.Serial;
import java.io.Serializable;
import java.util.ArrayList;
import java.util.List;

/**
 * 通用分页查询请求体。
 * 所有"查询业务类"统一 POST 此类。
 *
 * @author vex
 */
@Setter
@Getter
public class QueriesPageRequest implements Serializable {
    @Serial
    private static final long serialVersionUID = 1L;

    @Valid
    private QueriesPredicate predicate;
    @Valid
    private List<QueriesOrder> order;
    @Valid
    private QueriesPage page;

    /**
     * 向 AND 列表追加一个叶子条件; predicate / and 列表为空时自动创建。
     *
     * @param condition 叶子条件
     */
    public void addAndCondition(QueriesCondition condition) {
        if (predicate == null) {
            predicate = new QueriesPredicate();
        }
        if (predicate.getAnd() == null) {
            predicate.setAnd(new ArrayList<>());
        }
        predicate.getAnd().add(QueriesCriteria.of(condition));
    }

    /**
     * 根据当前用户上下文自动追加租户过滤条件。
     *
     * <p>逻辑:
     * <ul>
     *   <li>从 {@link UserContext#tenantId()} 获取当前租户 ID;</li>
     *   <li>若租户 ID 为 {@code null} 或 {@link TenantBaseEntity#DEFAULT_TENANT_ID} ("0", 超级管理员),
     *       则不追加条件,可查看全部租户数据;</li>
     *   <li>否则自动追加 {@code tenantId = <当前租户>} 条件。</li>
     * </ul>
     */
    public void withTenantFilter() throws BadRequestException {
        String tenantId = UserContext.tenantId().orElseThrow(() -> new BadRequestException("Tenant ID is required"));
        if (!TenantBaseEntity.DEFAULT_TENANT_ID.equals(tenantId)) {
            addAndCondition(QueriesCondition.of(TenantBaseEntity.TENANT_ID_FIELD_NAME, QueriesOperatorEnum.eq, tenantId));
        }
    }

}