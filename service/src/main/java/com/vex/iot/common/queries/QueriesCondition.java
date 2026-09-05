package com.vex.iot.common.queries;

import java.io.Serial;
import java.io.Serializable;

/**
 * 查询条件
 *
 * <p>单个比较条件：field + op + value。
 */
public class QueriesCondition implements Serializable {

    @Serial
    private static final long serialVersionUID = 1L;

    /**
     * 字段名
     */
    private String field;

    /**
     * 操作符
     */
    private QueriesOperatorEnum op;

    /**
     * 值
     */
    private Object value;

    /**
     * 快速构建叶子条件。
     *
     * @param field 字段名
     * @param op    操作符
     * @param value 比较值
     * @return 叶子条件
     */
    public static QueriesCondition of(String field, QueriesOperatorEnum op, Object value) {
        QueriesCondition c = new QueriesCondition();
        c.setField(field);
        c.setOp(op);
        c.setValue(value);
        return c;
    }

    /**
     * 获取字段名
     *
     * @return 字段名
     */
    public String getField() {
        return field;
    }

    /**
     * 设置字段名
     *
     * @param field 字段名
     */
    public void setField(String field) {
        this.field = field;
    }

    /**
     * 获取操作符
     *
     * @return 操作符
     */
    public QueriesOperatorEnum getOp() {
        return op;
    }

    /**
     * 设置操作符
     *
     * @param op 操作符
     */
    public void setOp(QueriesOperatorEnum op) {
        this.op = op;
    }

    /**
     * 获取值
     *
     * @return 值
     */
    public Object getValue() {
        return value;
    }

    /**
     * 设置值
     *
     * @param value 值
     */
    public void setValue(Object value) {
        this.value = value;
    }
}
