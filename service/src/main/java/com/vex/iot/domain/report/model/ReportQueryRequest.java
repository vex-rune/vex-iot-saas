package com.vex.iot.domain.report.model;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/// 报表执行请求
@Data
@NoArgsConstructor
@AllArgsConstructor
public class ReportQueryRequest {
    /// 已保存的报表定义 ID（与 schema 二选一，优先）
    private String definitionId;
    /// 内联 schema（调试 / 临时执行用）
    private ReportSchema schema;
    /// 额外过滤条件（叠加到 schema.filters 上）
    private ReportSchemaFilter filters;
    /// 行数上限
    private Integer limit;
}