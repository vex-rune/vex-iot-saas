package com.vex.iot.domain.report.model;

import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.ArrayList;
import java.util.List;

/// 报表查询 schema（三段式 JSON 结构）
@Data
@NoArgsConstructor
@AllArgsConstructor
public class ReportSchema {
    /// schema 版本号
    @JsonProperty("schemaVersion")
    private String schemaVersion = "1.0";
    /// 主数据源
    @NotNull
    private ReportDataSource source;
    /// 显式 JOIN（本期始终为空数组）
    @JsonProperty("joins")
    private List<Object> joins = new ArrayList<>();
    /// 列定义数组（1~20 条）
    @NotNull
    private List<ReportColumnDef> columns = new ArrayList<>();
    /// 单字段分组（可为 null）
    private ReportBreakout breakout;
    /// 过滤条件（复用 predicate 结构）
    private ReportSchemaFilter filters;
    /// 行数上限（默认 5000）
    private Integer limit = 5000;
}
