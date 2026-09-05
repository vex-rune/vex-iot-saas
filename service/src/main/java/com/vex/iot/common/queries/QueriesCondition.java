package com.vex.iot.common.queries;

import lombok.Data;
import lombok.Getter;
import lombok.Setter;

import java.io.Serial;
import java.io.Serializable;

/**
 * 查询条件
 *
 * <p>单个比较条件：field + op + value。
 */
@Data
public class QueriesCondition implements Serializable {

    @Serial
    private static final long serialVersionUID = 1L;

    private String field;
    private QueriesOperatorEnum op;
    private Object value;
    public static QueriesCondition of(String field, QueriesOperatorEnum op, Object value) {
        QueriesCondition c = new QueriesCondition();
        c.setField(field);
        c.setOp(op);
        c.setValue(value);
        return c;
    }

}
