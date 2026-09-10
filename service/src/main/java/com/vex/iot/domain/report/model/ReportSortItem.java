package com.vex.iot.domain.report.model;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/// 报表排序项
@Data
@NoArgsConstructor
@AllArgsConstructor
public class ReportSortItem {
    /// 排序字段所在数据源
    private ReportDataSource source;
    /// 排序字段名
    private String field;
    /// 排序方向（默认 ASC）
    private ReportSortDirection direction = ReportSortDirection.ASC;
}