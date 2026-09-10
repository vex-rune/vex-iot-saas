package com.vex.iot.domain.report.model;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/// 报表分组字段（单字段 GROUP BY）
@Data
@NoArgsConstructor
@AllArgsConstructor
public class ReportBreakout {
    /// 分组字段所在数据源
    private ReportDataSource source;
    /// 字段名
    private String field;
}
