package com.vex.iot.common.queries;

import jakarta.validation.Valid;
import lombok.Getter;
import lombok.Setter;

import java.io.Serial;
import java.io.Serializable;
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

}