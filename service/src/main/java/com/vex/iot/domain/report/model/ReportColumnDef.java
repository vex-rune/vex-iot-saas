package com.vex.iot.domain.report.model;

import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/// 报表列定义
@Data
@NoArgsConstructor
@AllArgsConstructor
public class ReportColumnDef {
    /// 输出列别名（唯一、正则校验）
    @NotNull
    private String alias;
    /// 引用的数据源
    @NotNull
    private ReportDataSource source;
    /// 字段名（必须在白名单中）
    @NotNull
    private String field;
    /// 聚合函数（默认 NONE）
    private ReportAggFunc agg = ReportAggFunc.NONE;
    /// 显示格式（默认 raw）
    private ReportDisplayFormat format = ReportDisplayFormat.raw;
    /// 字段间运算符（null 表示不运算）
    private ReportOperator op;
    /// 运算右操作数（op != null 时必填）
    private ReportOperand operand;
}
