package com.vex.iot.common.queries.jpa;

import com.vex.iot.common.exception.BusinessExceptions.BadRequestException;
import com.vex.iot.common.queries.*;
import jakarta.persistence.EntityManager;
import jakarta.persistence.TypedQuery;
import jakarta.persistence.criteria.*;

import java.util.ArrayList;
import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * JPA 通用查询执行器。
 *
 * <p>与 {@code MongoQueriesExecutor} 同 API,内部走 Jakarta JPA Criteria 链式。
 *
 * <p>典型用法:
 * <pre>{@code
 *   JpaQueriesExecutor<Device> qe = JpaQueriesExecutor.of(Device.class, entityManager);
 *   List<Device> rows = qe.page(request);
 *   long total = qe.count();
 * }</pre>
 *
 * @param <E> 实体类型
 */
public class JpaQueriesExecutor<E> {

    /**
     * 操作符 -> 谓词构建策略。线程安全,类加载时一次性初始化。
     */
    private static final Map<QueriesOperatorEnum, Function<PredicateContext, Predicate>> STRATEGY_CACHE = new ConcurrentHashMap<>();

    static {
        for (QueriesOperatorEnum op : QueriesOperatorEnum.values()) {
            STRATEGY_CACHE.put(op, createStrategy(op));
        }
    }

    private final Class<E> entityClass;
    private final EntityManager entityManager;
    private QueriesPredicate predicate;
    private List<QueriesOrder> orders;

    public JpaQueriesExecutor(Class<E> entityClass, EntityManager entityManager) {
        this.entityClass = entityClass;
        this.entityManager = entityManager;
    }

    public static <E> JpaQueriesExecutor<E> of(Class<E> entityClass, EntityManager entityManager) {
        return new JpaQueriesExecutor<>(entityClass, entityManager);
    }

    private static Function<PredicateContext, Predicate> createStrategy(QueriesOperatorEnum op) {
        return switch (op) {
            case eq -> ctx -> ctx.builder.equal(ctx.path, ctx.value);
            case ne -> ctx -> ctx.builder.notEqual(ctx.path, ctx.value);
            case gt -> ctx -> {
                requireComparable(ctx.value, ctx.operator);
                @SuppressWarnings({"unchecked", "rawtypes"})
                Class<Comparable> cls = (Class<Comparable>) ctx.value.getClass();
                @SuppressWarnings({"unchecked", "rawtypes"})
                Comparable v = (Comparable) ctx.value;
                return ctx.builder.greaterThan(ctx.path.as(cls), v);
            };
            case gte -> ctx -> {
                requireComparable(ctx.value, ctx.operator);
                @SuppressWarnings({"unchecked", "rawtypes"})
                Class<Comparable> cls = (Class<Comparable>) ctx.value.getClass();
                @SuppressWarnings({"unchecked", "rawtypes"})
                Comparable v = (Comparable) ctx.value;
                return ctx.builder.greaterThanOrEqualTo(ctx.path.as(cls), v);
            };
            case lt -> ctx -> {
                requireComparable(ctx.value, ctx.operator);
                @SuppressWarnings({"unchecked", "rawtypes"})
                Class<Comparable> cls = (Class<Comparable>) ctx.value.getClass();
                @SuppressWarnings({"unchecked", "rawtypes"})
                Comparable v = (Comparable) ctx.value;
                return ctx.builder.lessThan(ctx.path.as(cls), v);
            };
            case lte -> ctx -> {
                requireComparable(ctx.value, ctx.operator);
                @SuppressWarnings({"unchecked", "rawtypes"})
                Class<Comparable> cls = (Class<Comparable>) ctx.value.getClass();
                @SuppressWarnings({"unchecked", "rawtypes"})
                Comparable v = (Comparable) ctx.value;
                return ctx.builder.lessThanOrEqualTo(ctx.path.as(cls), v);
            };
            case like -> ctx -> {
                requireString(ctx.value, ctx.operator);
                return ctx.builder.like(ctx.path.as(String.class), (String) ctx.value);
            };
            case exp -> ctx -> {
                requireString(ctx.value, ctx.operator);
                // PostgreSQL 15+ 方言:regexp_like;其他数据库需换对应方言函数
                return ctx.builder.isTrue(ctx.builder.function("regexp_like",
                        Boolean.class, ctx.path.as(String.class), ctx.builder.literal(ctx.value)));
            };
            case in -> ctx -> {
                requireCollection(ctx.value, ctx.operator);
                return ctx.path.in((Collection<?>) ctx.value);
            };
            case isNull -> ctx -> {
                requireNull(ctx.value, ctx.operator);
                return ctx.builder.isNull(ctx.path);
            };
            case isNotNull -> ctx -> {
                requireNull(ctx.value, ctx.operator);
                return ctx.builder.isNotNull(ctx.path);
            };
        };
    }

    // ====== 策略实现 ======

    private static void requireComparable(Object value, QueriesOperatorEnum op) {
        if (value == null || !(value instanceof Comparable)) {
            throw new BadRequestException(op + " 操作符需要 Comparable 类型,实际=" + (value == null ? "null" : value.getClass().getName()));
        }
    }

    private static void requireString(Object value, QueriesOperatorEnum op) {
        if (!(value instanceof String)) {
            throw new BadRequestException(op + " 操作符需要 String 类型,实际=" + (value == null ? "null" : value.getClass().getName()));
        }
    }

    private static void requireNull(Object value, QueriesOperatorEnum op) {
        if (value != null) {
            throw new BadRequestException(op + " 操作符不需要传入值");
        }
    }

    private static void requireCollection(Object value, QueriesOperatorEnum op) {
        if (!(value instanceof Collection)) {
            throw new BadRequestException(op + " 操作符需要集合类型,实际=" + (value == null ? "null" : value.getClass().getName()));
        }
    }

    public List<E> page(QueriesPageRequest req) {
        if (req != null) {
            if (req.getPredicate() != null) this.predicate = req.getPredicate();
            if (req.getOrder() != null) this.orders = req.getOrder();
            if (req.getPage() != null) return page(req.getPage());
        }
        return list();
    }

    // ====== 查询入口 ======

    public List<E> page(QueriesPage page) {
        CriteriaBuilder builder = entityManager.getCriteriaBuilder();
        CriteriaQuery<E> query = buildSelectQuery(builder);

        int pageIndex = Math.max(page.getPage(), 0);
        int size = Math.max(page.getSize(), 1);
        TypedQuery<E> typedQuery = entityManager.createQuery(query);
        typedQuery.setFirstResult(pageIndex * size);
        typedQuery.setMaxResults(size);
        return typedQuery.getResultList();
    }

    public List<E> list() {
        CriteriaBuilder builder = entityManager.getCriteriaBuilder();
        CriteriaQuery<E> query = buildSelectQuery(builder);

        TypedQuery<E> typedQuery = entityManager.createQuery(query);
        typedQuery.setFirstResult(0);
        typedQuery.setMaxResults(10);
        return typedQuery.getResultList();
    }

    public long count() {
        CriteriaBuilder builder = entityManager.getCriteriaBuilder();
        CriteriaQuery<Long> query = builder.createQuery(Long.class);
        Root<E> root = query.from(entityClass);
        applyWhereClause(query, root, builder);
        query.select(builder.count(root.get("id")));
        return entityManager.createQuery(query).getSingleResult();
    }

    public long count(QueriesPredicate predicate) {
        this.predicate = predicate;
        return count();
    }

    public boolean exists(QueriesPredicate predicate) {
        return count(predicate) > 0;
    }

    private CriteriaQuery<E> buildSelectQuery(CriteriaBuilder builder) {
        CriteriaQuery<E> query = builder.createQuery(entityClass);
        Root<E> root = query.from(entityClass);
        applyWhereClause(query, root, builder);
        applyOrdering(query, root, builder);
        return query;
    }

    // ====== 构建内部 ======

    private void applyWhereClause(CriteriaQuery<?> query, Root<?> root, CriteriaBuilder builder) {
        if (isEmptyPredicate(predicate)) {
            query.where();
            return;
        }
        List<Predicate> predicates = new ArrayList<>();
        if (predicate.getAnd() != null && !predicate.getAnd().isEmpty()) {
            predicates.add(buildPredicateFromCriteria(predicate.getAnd(), true, root, builder));
        }
        if (predicate.getOr() != null && !predicate.getOr().isEmpty()) {
            predicates.add(buildPredicateFromCriteria(predicate.getOr(), false, root, builder));
        }
        if (predicates.isEmpty()) {
            query.where();
        } else if (predicates.size() == 1) {
            query.where(predicates.get(0));
        } else {
            query.where(builder.and(predicates.toArray(new Predicate[0])));
        }
    }

    private Predicate buildPredicateFromCriteria(List<QueriesCriteria> criteriaList,
                                                 boolean isAnd,
                                                 Root<?> root,
                                                 CriteriaBuilder builder) {
        List<Predicate> predicates = new ArrayList<>();
        for (QueriesCriteria c : criteriaList) {
            if (c.getCondition() != null) {
                predicates.add(buildPredicateFromCondition(c.getCondition(), root, builder));
            } else if (c.getPredicate() != null) {
                predicates.add(buildPredicateFromCriteria(c.getPredicate().getAnd(), true, root, builder));
            }
        }
        if (predicates.isEmpty()) return builder.conjunction();
        return isAnd
                ? builder.and(predicates.toArray(new Predicate[0]))
                : builder.or(predicates.toArray(new Predicate[0]));
    }

    private Predicate buildPredicateFromCondition(QueriesCondition c, Root<?> root, CriteriaBuilder builder) {
        if (c.getField() == null || c.getField().isBlank()) {
            throw new BadRequestException("查询条件 field 不能为空");
        }
        Function<PredicateContext, Predicate> strategy = STRATEGY_CACHE.get(c.getOp());
        if (strategy == null) {
            throw new BadRequestException("不支持的操作符: " + c.getOp());
        }
        return strategy.apply(new PredicateContext(builder, root.get(c.getField()), c.getValue(), c.getOp()));
    }

    private void applyOrdering(CriteriaQuery<E> query, Root<E> root, CriteriaBuilder builder) {
        if (orders == null || orders.isEmpty()) return;
        List<Order> orderList = orders.stream()
                .map(o -> o.getOrder() == QueriesOrder.QueriesOrderEnum.DESC
                        ? builder.desc(root.get(o.getField()))
                        : builder.asc(root.get(o.getField())))
                .collect(Collectors.toList());
        query.orderBy(orderList);
    }

    private boolean isEmptyPredicate(QueriesPredicate p) {
        return p == null
                || ((p.getAnd() == null || p.getAnd().isEmpty())
                && (p.getOr() == null || p.getOr().isEmpty()));
    }

    private record PredicateContext(CriteriaBuilder builder, Path<?> path, Object value, QueriesOperatorEnum operator) {
    }
}