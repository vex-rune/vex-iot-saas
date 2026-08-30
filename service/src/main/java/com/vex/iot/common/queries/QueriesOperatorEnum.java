package com.vex.iot.common.queries;

/**
 * 查询操作符枚举
 *
 * <p>比较操作符。
 */
public enum QueriesOperatorEnum {
    /**
     * 等于
     */
    eq,
    /**
     * 不等于
     */
    ne,
    /**
     * 大于
     */
    gt,
    /**
     * 大于等于
     */
    gte,
    /**
     * 小于
     */
    lt,
    /**
     * 小于等于
     */
    lte,
    /**
     * 模糊匹配(等价 SQL LIKE)
     */
    like,
    /**
     * 正则匹配
     */
    exp,
    /**
     * IN
     */
    in,
    /**
     * IS NULL
     */
    isNull,
    /**
     * IS NOT NULL
     */
    isNotNull
}
