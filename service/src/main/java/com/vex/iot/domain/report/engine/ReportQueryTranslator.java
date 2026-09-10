package com.vex.iot.domain.report.engine;

import com.vex.iot.common.model.TenantBaseEntity;
import com.vex.iot.common.queries.QueriesCondition;
import com.vex.iot.common.queries.QueriesPredicate;
import com.vex.iot.common.util.UserContext;
import com.vex.iot.domain.device.model.DataEntity;
import com.vex.iot.domain.device.model.DeviceEntity;
import com.vex.iot.domain.device.model.RealtimeDataEntity;
import com.vex.iot.domain.report.model.*;
import jakarta.persistence.EntityManager;
import jakarta.persistence.criteria.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.*;

/// 核心翻译器：将 ReportSchema 编译为 JPA CriteriaQuery
/// 受信模块——内部只用 CriteriaBuilder / Path / Expression，不拼 SQL 字符串
@Slf4j
@Component
@RequiredArgsConstructor
public class ReportQueryTranslator {

    private final EntityManager entityManager;
    private final ReportFieldWhitelist whitelist;

    /// root 实体类型映射
    private final Map<ReportDataSource, Class<?>> ROOT_CLASSES = Map.of(
            ReportDataSource.DEVICE, DeviceEntity.class,
            ReportDataSource.POINT_HISTORY, DataEntity.class,
            ReportDataSource.POINT_REALTIME, RealtimeDataEntity.class
    );

    /// 翻译完整查询，返回 Tuple 列表
    public List<Object[]> translate(ReportSchema schema, QueriesPredicate extraFilters) {
        CriteriaBuilder cb = entityManager.getCriteriaBuilder();
        CriteriaQuery<Object[]> query = cb.createQuery(Object[].class);
        ReportDataSource source = schema.getSource();
        Root<?> root = query.from(ROOT_CLASSES.get(source));

        // 隐式 JOIN
        Join<?, ?> historyJoin = null, realtimeJoin = null;
        if (source == ReportDataSource.DEVICE) {
            historyJoin = root.join("history", JoinType.LEFT);
            realtimeJoin = root.join("realtime", JoinType.LEFT);
        }

        // 租户过滤
        applyTenantFilter(cb, query, root);

        // schema.filters
        if (schema.getFilters() != null && schema.getFilters().getAnd() != null) {
            for (QueriesPredicate pred : schema.getFilters().getAnd()) {
                applyCondition(cb, query, root, historyJoin, realtimeJoin, pred);
            }
        }
        if (schema.getFilters() != null && schema.getFilters().getOr() != null) {
            List<CriteriaQuery<Object[]>> orQueries = new ArrayList<>();
            for (QueriesPredicate pred : schema.getFilters().getOr()) {
                applyCondition(cb, query, root, historyJoin, realtimeJoin, pred);
            }
        }

        // extra filters
        if (extraFilters != null && extraFilters.getAnd() != null) {
            for (QueriesPredicate pred : extraFilters.getAnd()) {
                applyCondition(cb, query, root, historyJoin, realtimeJoin, pred);
            }
        }

        // SELECT 列
        List<Selection<?>> selectCols = new ArrayList<>();
        List<String> aliases = new ArrayList<>();
        for (ReportColumnDef col : schema.getColumns()) {
            Path<?> fieldPath = getFieldPath(root, historyJoin, realtimeJoin, col.getSource(), col.getField());
            Selection<?> sel;
            String alias = col.getAlias();
            aliases.add(alias);
            if (col.getAgg() == ReportAggFunc.NONE && col.getOp() == null) {
                sel = fieldPath.alias(alias);
            } else if (col.getAgg() == ReportAggFunc.NONE && col.getOp() != null) {
                Path<?> rightField = getFieldPath(root, historyJoin, realtimeJoin,
                        col.getOperand().getSource(), col.getOperand().getField());
                sel = applyOp(cb, fieldPath, col.getOp(), rightField).alias(alias);
            } else if (col.getAgg() != ReportAggFunc.NONE && col.getOp() == null) {
                sel = applyAgg(cb, col.getAgg(), fieldPath).alias(alias);
            } else {
                // agg + op
                Expression<?> leftAgg = applyAgg(cb, col.getAgg(), fieldPath);
                Expression<?> rightAgg = applyAgg(cb, col.getOperand().getAgg(),
                        getFieldPath(root, historyJoin, realtimeJoin,
                                col.getOperand().getSource(), col.getOperand().getField()));
                sel = applyOp(cb, leftAgg, col.getOp(), rightAgg).alias(alias);
            }
            selectCols.add(sel);
        }
        query.select(cb.array(selectCols.toArray(new Selection<?>[0])));

        // GROUP BY
        if (schema.getBreakout() != null) {
            Path<?> breakPath = getFieldPath(root, historyJoin, realtimeJoin,
                    schema.getBreakout().getSource(), schema.getBreakout().getField());
            query.groupBy(breakPath);
        }

        // LIMIT
        return entityManager.createQuery(query)
                .setMaxResults(schema.getLimit() != null ? schema.getLimit() : 5000)
                .getResultList();
    }

    /// 获取字段 JPA Path
    private Path<?> getFieldPath(Root<?> root, Join<?, ?> hJoin, Join<?, ?> rJoin,
                                 ReportDataSource fieldSource, String fieldName) {
        String jpaField = whitelist.getJpaPath(fieldSource, fieldName);
        return switch (fieldSource) {
            case DEVICE -> root.get(jpaField);
            case POINT_HISTORY -> hJoin.get(jpaField);
            case POINT_REALTIME -> rJoin.get(jpaField);
        };
    }

    /// 应用聚合函数
    private Expression<?> applyAgg(CriteriaBuilder cb, ReportAggFunc func, Path<?> path) {
        return switch (func) {
            case SUM -> cb.sum((Expression<Number>) path);
            case AVG -> cb.avg((Expression<Number>) path);
            case MIN -> cb.min((Expression<Comparable>) path);
            case MAX -> cb.max((Expression<Comparable>) path);
            case COUNT -> cb.count(path);
            case COUNT_DISTINCT -> cb.countDistinct(path);
            default -> path;
        };
    }

    /// 应用字段间运算
    private Expression<?> applyOp(CriteriaBuilder cb, Expression<?> left,
                                  ReportOperator op, Expression<?> right) {
        return switch (op) {
            case ADD -> cb.sum((Expression<Number>) left, (Expression<Number>) right);
            case SUB -> cb.diff((Expression<Number>) left, (Expression<Number>) right);
            case MUL -> cb.prod((Expression<Number>) left, (Expression<Number>) right);
            case DIV -> cb.quot((Expression<Number>) left, (Expression<Number>) right);
        };
    }

    /// 应用过滤条件到 WHERE
    private void applyCondition(CriteriaBuilder cb, CriteriaQuery<?> query,
                                Root<?> root, Join<?, ?> hJoin, Join<?, ?> rJoin,
                                QueriesPredicate pred) {
        if (pred == null) return;
        if (pred.getCondition() != null) {
            QueriesCondition c = pred.getCondition();
            String field = c.getField();
            // 确定字段所在 source
            Path<?> path = resolveFieldPath(root, hJoin, rJoin, field);
            Predicate p = buildPredicate(cb, path, c);
            if (p != null) query.where(p);
        }
        if (pred.getAnd() != null) {
            for (QueriesPredicate inner : pred.getAnd()) {
                applyCondition(cb, query, root, hJoin, rJoin, inner);
            }
        }
    }

    /// 根据字段名自动推断数据源路径
    private Path<?> resolveFieldPath(Root<?> root, Join<?, ?> hJoin, Join<?, ?> rJoin, String field) {
        String jpaField = whitelist.getJpaPath(ReportDataSource.POINT_HISTORY, field);
        // 默认从 history 取，如果 history 不存在则从 device 取
        try {
            if (hJoin != null && hJoin.getModel().getAttribute(jpaField) != null) {
                return hJoin.get(jpaField);
            }
        } catch (Exception ignored) {
        }
        try {
            return root.get(jpaField);
        } catch (Exception ignored) {
        }
        // 回退到 realtime
        if (rJoin != null) {
            try {
                return rJoin.get(jpaField);
            } catch (Exception ignored) {
            }
        }
        return root.get(field);
    }

    /// 构建单个谓词
    private Predicate buildPredicate(CriteriaBuilder cb, Path<?> path, QueriesCondition c) {
        String op = c.getOp();
        Object value = c.getValue();
        return switch (op != null ? op.toLowerCase() : "") {
            case "eq" -> cb.equal(path, value);
            case "ne" -> cb.notEqual(path, value);
            case "gt" -> cb.greaterThan((Expression<Comparable>) path, (Comparable) value);
            case "gte" -> cb.greaterThanOrEqualTo((Expression<Comparable>) path, (Comparable) value);
            case "lt" -> cb.lessThan((Expression<Comparable>) path, (Comparable) value);
            case "lte" -> cb.lessThanOrEqualTo((Expression<Comparable>) path, (Comparable) value);
            case "like" -> cb.like((Expression<String>) path, "%" + value + "%");
            case "in" -> {
                CriteriaBuilder.In<Object> in = cb.in(path);
                if (value instanceof Collection<?> col) col.forEach(in::value);
                yield in;
            }
            default -> null;
        };
    }

    /// 租户过滤（无条件追加）
    private void applyTenantFilter(CriteriaBuilder cb, CriteriaQuery<?> query, Root<?> root) {
        String tenantId = UserContext.tenantId().orElse(null);
        if (tenantId == null || tenantId.isBlank()) {
            throw new com.vex.iot.common.exception.BadRequestException("unauthorized", "未识别租户");
        }
        Predicate p = cb.equal(root.get(TenantBaseEntity.TENANT_ID_FIELD_NAME), tenantId);
        query.where(p);
    }
}
