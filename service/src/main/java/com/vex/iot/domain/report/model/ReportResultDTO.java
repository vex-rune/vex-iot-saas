package com.vex.iot.domain.report.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.List;
import java.util.Map;

/// 报表执行响应 DTO
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ReportResultDTO {
    /// 输出列元数据
    private List<ColumnInfo> columns;
    /// 结果行
    private List<Map<String, Object>> rows;
    /// 实际返回行数
    private int rowCount;
    /// 是否被 limit 截断
    private boolean truncated;
    /// 执行完成时间
    private Instant executedAt;
    /// 执行耗时（毫秒）
    private long elapsedMs;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ColumnInfo {
        private String alias;
        private String displayName;
        private String type;
    }
}