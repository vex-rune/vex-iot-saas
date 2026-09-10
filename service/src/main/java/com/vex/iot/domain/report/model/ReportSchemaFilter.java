package com.vex.iot.domain.report.model;

import com.vex.iot.common.queries.QueriesCriteria;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/// 报表过滤条件（复用 QueriesPredicate 的 and/or 列表结构）
@Data
@NoArgsConstructor
@AllArgsConstructor
public class ReportSchemaFilter {
    private List<QueriesCriteria> and;
    private List<QueriesCriteria> or;
}
