package com.vex.iot.common.queries;

import jakarta.validation.Valid;

import java.io.Serial;
import java.io.Serializable;

/**
 * 查询条件项
 *
 * <p>condition(叶子) / predicate(嵌套) 二选一。
 */
public class QueriesCriteria implements Serializable {

    @Serial
    private static final long serialVersionUID = 1L;

    /**
     * 叶子条件
     */
    @Valid private QueriesCondition condition;

    /**
     * 嵌套谓词
     */
    @Valid private QueriesPredicate predicate;

    /**
     * 获取叶子条件
     *
     * @return 叶子条件
     */
    public QueriesCondition getCondition() {
        return condition;
    }

    /**
     * 设置叶子条件
     *
     * @param condition 叶子条件
     */
    public void setCondition(QueriesCondition condition) {
        this.condition = condition;
    }

    /**
     * 获取嵌套谓词
     *
     * @return 嵌套谓词
     */
    public QueriesPredicate getPredicate() {
        return predicate;
    }

    /**
     * 设置嵌套谓词
     *
     * @param predicate 嵌套谓词
     */
    public void setPredicate(QueriesPredicate predicate) {
        this.predicate = predicate;
    }
}
