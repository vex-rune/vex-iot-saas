package com.vex.iot.domain.report.model;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/// 报表运算操作数（右侧操作数）
@Data
@NoArgsConstructor
@AllArgsConstructor
public class ReportOperand {
    /// 引用的数据源
    private ReportDataSource source;
    /// 字段名
    private String field;
    /// 聚合函数
    private ReportAggFunc agg = ReportAggFunc.NONE;
}
