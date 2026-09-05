package com.vex.iot.common.queries;

import jakarta.validation.Valid;
import lombok.Data;

import java.io.Serial;
import java.io.Serializable;

/**
 * 查询条件项
 *
 * <p>condition(叶子) / predicate(嵌套) 二选一。
 */
@Data
public class QueriesCriteria implements Serializable {

    @Serial
    private static final long serialVersionUID = 1L;

    /**
     * 叶子条件
     */
    @Valid
    private QueriesCondition condition;

    /**
     * 嵌套谓词
     */
    @Valid
    private QueriesPredicate predicate;

    /**
     * 用叶子条件快速构建 Criteria。
     *
     * @param condition 叶子条件
     * @return Criteria
     */
    public static QueriesCriteria of(QueriesCondition condition) {
        QueriesCriteria c = new QueriesCriteria();
        c.setCondition(condition);
        return c;
    }
}
