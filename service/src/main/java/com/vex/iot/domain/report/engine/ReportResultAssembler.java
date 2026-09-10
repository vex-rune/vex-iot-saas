package com.vex.iot.domain.report.engine;

import com.vex.iot.domain.report.model.ReportColumnDef;
import com.vex.iot.domain.report.model.ReportDisplayFormat;
import com.vex.iot.domain.report.model.ReportResultDTO;
import com.vex.iot.domain.report.model.ReportSchema;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/// 报表结果装配器
/// 职责：将查询引擎返回的 Object[] 行数据转换为 ReportResultDTO，并应用显示格式
@Component
public class ReportResultAssembler {

    private static final DateTimeFormatter DATE_FMT = DateTimeFormatter
            .ofPattern("yyyy-MM-dd HH:mm:ss")
            .withZone(ZoneId.systemDefault());

    /// 自动为缺少 alias 的列生成唯一别名
    public void assignAliases(ReportSchema schema) {
        List<ReportColumnDef> columns = schema.getColumns();
        for (int i = 0; i < columns.size(); i++) {
            ReportColumnDef col = columns.get(i);
            if (col.getAlias() == null || col.getAlias().isBlank()) {
                col.setAlias("col_" + (i + 1));
            }
        }
    }

    /// 构建列元数据
    public List<ReportResultDTO.ColumnInfo> buildColumnInfos(ReportSchema schema) {
        List<ReportResultDTO.ColumnInfo> colInfos = new ArrayList<>();
        for (ReportColumnDef col : schema.getColumns()) {
            String displayName = (col.getDisplayName() != null && !col.getDisplayName().isBlank())
                    ? col.getDisplayName() : col.getAlias();
            colInfos.add(new ReportResultDTO.ColumnInfo(col.getAlias(), displayName, col.getAgg().name()));
        }
        return colInfos;
    }

    /// 将 Object[][] 行数据转换为 Map 行数据（key=alias），并应用格式化
    public List<Map<String, Object>> buildRowMaps(List<Object[]> rows,
                                                  List<ReportResultDTO.ColumnInfo> colInfos,
                                                  List<ReportColumnDef> columnDefs) {
        List<Map<String, Object>> rowMaps = new ArrayList<>();
        for (Object[] row : rows) {
            Map<String, Object> map = new LinkedHashMap<>();
            for (int i = 0; i < colInfos.size() && i < row.length; i++) {
                String alias = colInfos.get(i).getAlias();
                ReportDisplayFormat fmt = (columnDefs != null && i < columnDefs.size())
                        ? columnDefs.get(i).getFormat() : null;
                map.put(alias, formatValue(row[i], fmt));
            }
            rowMaps.add(map);
        }
        return rowMaps;
    }

    /// 组装完整的 ReportResultDTO
    public ReportResultDTO assemble(ReportSchema schema, List<Object[]> rows,
                                    long elapsedMs, int effectiveLimit) {
        List<ReportResultDTO.ColumnInfo> colInfos = buildColumnInfos(schema);
        List<Map<String, Object>> rowMaps = buildRowMaps(rows, colInfos, schema.getColumns());
        boolean truncated = rows.size() >= effectiveLimit;

        return ReportResultDTO.builder()
                .columns(colInfos)
                .rows(rowMaps)
                .rowCount(rowMaps.size())
                .truncated(truncated)
                .executedAt(Instant.now())
                .elapsedMs(elapsedMs)
                .build();
    }

    // ─── 格式化 ──────────────────────────────────────────────

    private Object formatValue(Object value, ReportDisplayFormat fmt) {
        if (value == null || fmt == null || fmt == ReportDisplayFormat.raw) {
            return value;
        }
        return switch (fmt) {
            case decimal2 -> formatDecimal(value, 2);
            case decimal4 -> formatDecimal(value, 4);
            case percent2 -> formatPercent(value);
            case integer -> formatInteger(value);
            case strings -> value == null ? "" : String.valueOf(value);
            default -> value;
        };
    }

    private String formatDecimal(Object value, int scale) {
        BigDecimal bd = toBigDecimal(value);
        if (bd == null) return "";
        return bd.setScale(scale, RoundingMode.HALF_UP).toPlainString();
    }

    private String formatPercent(Object value) {
        BigDecimal bd = toBigDecimal(value);
        if (bd == null) return "";
        return bd.multiply(BigDecimal.valueOf(100))
                .setScale(2, RoundingMode.HALF_UP)
                .toPlainString() + "%";
    }

    private Object formatInteger(Object value) {
        if (value == null) return null;
        if (value instanceof Number n) return n.longValue();
        try {
            return Long.parseLong(String.valueOf(value));
        } catch (Exception e) {
            return value;
        }
    }

    private BigDecimal toBigDecimal(Object value) {
        if (value == null) return null;
        if (value instanceof BigDecimal bd) return bd;
        if (value instanceof Number n) return BigDecimal.valueOf(n.doubleValue());
        try {
            return new BigDecimal(String.valueOf(value));
        } catch (Exception e) {
            return null;
        }
    }
}