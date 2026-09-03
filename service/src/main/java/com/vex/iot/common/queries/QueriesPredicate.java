package com.vex.iot.common.queries;

import jakarta.validation.Valid;

import java.io.Serial;
import java.io.Serializable;
import java.util.List;

/**
 * 查询条件组合:支持 AND / OR 嵌套。
 *
 * @author vex
 */
public class QueriesPredicate implements Serializable {
    @Serial
    private static final long serialVersionUID = 1L;

    @Valid
    private List<QueriesCriteria> and;
    @Valid
    private List<QueriesCriteria> or;

    public List<QueriesCriteria> getAnd() {
        return and;
    }

    public void setAnd(List<QueriesCriteria> and) {
        this.and = and;
    }

    public List<QueriesCriteria> getOr() {
        return or;
    }

    public void setOr(List<QueriesCriteria> or) {
        this.or = or;
    }
}