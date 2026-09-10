package com.vex.iot.domain.report.model;

import com.vex.iot.common.queries.QueriesCondition;
import com.vex.iot.common.queries.QueriesPredicate;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/// 报表过滤条件（复用 QueriesPredicate 结构）
@Data
@NoArgsConstructor
@AllArgsConstructor
public class ReportSchemaFilter {
    private List<QueriesPredicate> and;
    private List<QueriesPredicate> or;
}
