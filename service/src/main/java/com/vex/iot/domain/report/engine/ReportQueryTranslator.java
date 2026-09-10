package com.vex.iot.domain.report.engine;

import com.vex.iot.common.model.TenantBaseEntity;
import com.vex.iot.common.queries.QueriesCondition;
import com.vex.iot.common.queries.QueriesCriteria;
import com.vex.iot.common.queries.QueriesOperatorEnum;
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

@Slf4j
@Component
@RequiredArgsConstructor
public class ReportQueryTranslator {

    private final EntityManager entityManager;
    private final ReportFieldWhitelist whitelist;

    private static final Map<ReportDataSource, Class<?>> ROOT_CLASSES = Map.of(
            ReportDataSource.DEVICE, DeviceEntity.class,
            ReportDataSource.POINT_HISTORY, DataEntity.class,
            ReportDataSource.POINT_REALTIME, RealtimeDataEntity.class
    );

    private static final Map<String, JoinKey> JOIN_KEYS = Map.of(
            "DEVICE:POINT_HISTORY",
            new JoinKey(ReportDataSource.DEVICE, "id", ReportDataSource.POINT_HISTORY, "deviceId"),
            "DEVICE:POINT_REALTIME",
            new JoinKey(ReportDataSource.DEVICE, "id", ReportDataSource.POINT_REALTIME, "deviceId")
    );

    public List<Object[]> translate(ReportSchema schema, ReportSchemaFilter extraFilters) {
        CriteriaBuilder cb = entityManager.getCriteriaBuilder();
        CriteriaQuery<Object[]> query = cb.createQuery(Object[].class);
        ReportDataSource source = schema.getSource();

        Set<ReportDataSource> neededSources = collectNeededSources(schema);

        Map<ReportDataSource, Root<?>> roots = new LinkedHashMap<>();
        for (ReportDataSource src : neededSources) {
            roots.put(src, query.from(ROOT_CLASSES.get(src)));
        }
        Root<?> primaryRoot = roots.get(source);

        List<Predicate> wherePredicates = new ArrayList<>();
        String tenantId = UserContext.tenantId().orElse(null);
        if (tenantId == null || tenantId.isBlank()) {
            throw new IllegalArgumentException("未识别租户");
        }
        // tenant filter on ALL roots（DEFAULT_TENANT_ID 跳过，可查看所有租户数据）
        if (!TenantBaseEntity.DEFAULT_TENANT_ID.equals(tenantId)) {
            for (Root<?> r : roots.values()) {
                wherePredicates.add(cb.equal(r.get(TenantBaseEntity.TENANT_ID_FIELD_NAME), tenantId));
            }
        }
        addJoinConditions(cb, roots, wherePredicates);
        collectFromFilter(cb, primaryRoot, source, schema.getFilters(), wherePredicates);
        collectFromFilter(cb, primaryRoot, source, extraFilters, wherePredicates);

        query.where(wherePredicates.toArray(new Predicate[0]));

        List<Selection<?>> selectCols = new ArrayList<>();
        for (ReportColumnDef col : schema.getColumns()) {
            Path<?> fieldPath = resolvePath(roots, col.getSource(), col.getField());
            Selection<?> sel;
            String alias = col.getAlias();
            if (col.getAgg() == ReportAggFunc.NONE && col.getOp() == null) {
                sel = fieldPath.alias(alias);
            } else if (col.getAgg() == ReportAggFunc.NONE && col.getOp() != null) {
                Path<?> rightField = resolvePath(roots,
                        col.getOperand().getSource(), col.getOperand().getField());
                sel = applyOp(cb, fieldPath, col.getOp(), rightField).alias(alias);
            } else if (col.getAgg() != ReportAggFunc.NONE && col.getOp() == null) {
                sel = applyAgg(cb, col.getAgg(), fieldPath).alias(alias);
            } else {
                Expression<?> leftAgg = applyAgg(cb, col.getAgg(), fieldPath);
                Expression<?> rightAgg = applyAgg(cb, col.getOperand().getAgg(),
                        resolvePath(roots, col.getOperand().getSource(), col.getOperand().getField()));
                sel = applyOp(cb, leftAgg, col.getOp(), rightAgg).alias(alias);
            }
            selectCols.add(sel);
        }
        query.select(cb.array(selectCols.toArray(new Selection<?>[0])));

        if (schema.getBreakout() != null) {
            Path<?> breakPath = resolvePath(roots,
                    schema.getBreakout().getSource(), schema.getBreakout().getField());
            query.groupBy(breakPath);
        }

        // ORDER BY
        List<Order> orderList = new ArrayList<>();
        if (schema.getSort() != null) {
            for (ReportSortItem sortItem : schema.getSort()) {
                Path<?> sortPath = resolvePath(roots, sortItem.getSource(), sortItem.getField());
                orderList.add(sortItem.getDirection() == ReportSortDirection.DESC
                        ? cb.desc(sortPath) : cb.asc(sortPath));
            }
        }
        if (!orderList.isEmpty()) {
            query.orderBy(orderList);
        }

        return entityManager.createQuery(query)
                .setMaxResults(schema.getLimit() != null ? schema.getLimit() : 5000)
                .getResultList();
    }

    private Set<ReportDataSource> collectNeededSources(ReportSchema schema) {
        Set<ReportDataSource> sources = new LinkedHashSet<>();
        sources.add(schema.getSource());
        for (ReportColumnDef col : schema.getColumns()) {
            sources.add(col.getSource());
            if (col.getOperand() != null) {
                sources.add(col.getOperand().getSource());
            }
        }
        if (schema.getBreakout() != null) {
            sources.add(schema.getBreakout().getSource());
        }
        return sources;
    }

    private void addJoinConditions(CriteriaBuilder cb,
                                   Map<ReportDataSource, Root<?>> roots,
                                   List<Predicate> out) {
        List<ReportDataSource> sourceList = new ArrayList<>(roots.keySet());
        for (int i = 0; i < sourceList.size(); i++) {
            for (int j = i + 1; j < sourceList.size(); j++) {
                ReportDataSource s1 = sourceList.get(i);
                ReportDataSource s2 = sourceList.get(j);
                JoinKey key = JOIN_KEYS.get(s1 + ":" + s2);
                if (key == null) key = JOIN_KEYS.get(s2 + ":" + s1);
                if (key != null) {
                    Root<?> leftRoot = roots.get(key.leftSource());
                    Root<?> rightRoot = roots.get(key.rightSource());
                    if (leftRoot != null && rightRoot != null) {
                        out.add(cb.equal(leftRoot.get(key.leftField()),
                                rightRoot.get(key.rightField())));
                    }
                }
            }
        }
    }

    private Path<?> resolvePath(Map<ReportDataSource, Root<?>> roots,
                                ReportDataSource fieldSource, String fieldName) {
        Root<?> root = roots.get(fieldSource);
        if (root == null) {
            throw new IllegalArgumentException(
                    "\u6570\u636e\u6e90 " + fieldSource + " \u672a\u627e\u5230, \u65e0\u6cd5\u89e3\u6790\u5b57\u6bb5 " + fieldName);
        }
        String jpaField = whitelist.getJpaPath(fieldSource, fieldName);
        return root.get(jpaField);
    }

    @SuppressWarnings({"unchecked", "rawtypes"})
    private Expression<?> applyAgg(CriteriaBuilder cb, ReportAggFunc agg, Path<?> field) {
        return switch (agg) {
            case SUM -> cb.sum(field.as(Double.class));
            case AVG -> cb.avg(field.as(Double.class));
            case MIN -> cb.min((Expression) field);
            case MAX -> cb.max((Expression) field);
            case COUNT -> cb.count(field);
            case COUNT_DISTINCT -> cb.countDistinct(field);
            case NONE -> field;
        };
    }

    @SuppressWarnings({"unchecked", "rawtypes"})
    private Expression<?> applyOp(CriteriaBuilder cb, Expression<?> left,
                                  ReportOperator op, Expression<?> right) {
        Expression l = left;
        Expression r = right;
        return switch (op) {
            case ADD -> cb.sum(l, r);
            case SUB -> cb.diff(l, r);
            case MUL -> cb.prod(l, r);
            case DIV -> cb.quot(l, r);
        };
    }

    private void collectFromFilter(CriteriaBuilder cb, Root<?> root,
                                   ReportDataSource source,
                                   ReportSchemaFilter filter, List<Predicate> out) {
        if (filter == null) return;
        if (filter.getAnd() != null) {
            collectCriteriaList(cb, root, source, filter.getAnd(), true, out);
        }
        if (filter.getOr() != null) {
            collectCriteriaList(cb, root, source, filter.getOr(), false, out);
        }
    }

    private void collectCriteriaList(CriteriaBuilder cb, Root<?> root,
                                     ReportDataSource source,
                                     List<QueriesCriteria> criteriaList,
                                     boolean isAnd, List<Predicate> out) {
        List<Predicate> predicates = new ArrayList<>();
        for (QueriesCriteria c : criteriaList) {
            if (c.getCondition() != null) {
                predicates.add(buildCondition(cb, root, source, c.getCondition()));
            } else if (c.getPredicate() != null) {
                QueriesPredicate nested = c.getPredicate();
                if (nested.getAnd() != null) {
                    collectCriteriaList(cb, root, source, nested.getAnd(), true, predicates);
                }
                if (nested.getOr() != null) {
                    collectCriteriaList(cb, root, source, nested.getOr(), false, predicates);
                }
            }
        }
        if (!predicates.isEmpty()) {
            if (isAnd) {
                out.addAll(predicates);
            } else {
                out.add(cb.or(predicates.toArray(new Predicate[0])));
            }
        }
    }

    @SuppressWarnings({"unchecked", "rawtypes"})
    private Predicate buildCondition(CriteriaBuilder cb, Root<?> root,
                                     ReportDataSource source,
                                     QueriesCondition c) {
        String field = c.getField();
        String jpaField = whitelist.getJpaPath(source, field);
        Path<?> path = root.get(jpaField);
        QueriesOperatorEnum op = c.getOp();
        Object value = convertValue(root, jpaField, c.getValue());
        return switch (op) {
            case eq -> cb.equal(path, value);
            case ne -> cb.notEqual(path, value);
            case gt -> cb.greaterThan((Expression) path, (Comparable) value);
            case gte -> cb.greaterThanOrEqualTo((Expression) path, (Comparable) value);
            case lt -> cb.lessThan((Expression) path, (Comparable) value);
            case lte -> cb.lessThanOrEqualTo((Expression) path, (Comparable) value);
            case like -> cb.like(path.as(String.class), (String) value);
            case in -> {
                CriteriaBuilder.In<Object> in = cb.in(path);
                if (value instanceof Collection<?> col) col.forEach(in::value);
                yield in;
            }
            default -> cb.conjunction();
        };
    }

    /// 根据 JPA 属性的实际类型，将 String 值转换为对应 Java 类型
    private Object convertValue(Root<?> root, String jpaField, Object value) {
        if (value == null) return null;
        if (!(value instanceof String str)) return value;

        Class<?> javaType = root.getModel().getAttribute(jpaField).getJavaType();
        if (javaType == null) return value;

        // Instant / Date
        if (javaType == java.time.Instant.class) {
            return java.time.Instant.parse(str);
        }
        if (javaType == java.time.LocalDateTime.class) {
            return java.time.LocalDateTime.parse(str);
        }
        if (javaType == java.time.LocalDate.class) {
            return java.time.LocalDate.parse(str);
        }
        // 数值
        if (javaType == Long.class || javaType == long.class) {
            return Long.parseLong(str);
        }
        if (javaType == Integer.class || javaType == int.class) {
            return Integer.parseInt(str);
        }
        if (javaType == Double.class || javaType == double.class) {
            return Double.parseDouble(str);
        }
        if (javaType == Float.class || javaType == float.class) {
            return Float.parseFloat(str);
        }
        if (javaType == Boolean.class || javaType == boolean.class) {
            return Boolean.parseBoolean(str);
        }
        // 枚举
        if (javaType.isEnum()) {
            return Enum.valueOf((Class<Enum>) javaType, str);
        }
        return value;
    }

    private record JoinKey(ReportDataSource leftSource, String leftField,
                           ReportDataSource rightSource, String rightField) {
    }
}