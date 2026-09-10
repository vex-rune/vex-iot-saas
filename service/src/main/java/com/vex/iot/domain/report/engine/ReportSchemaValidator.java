package com.vex.iot.domain.report.engine;

import com.vex.iot.common.exception.BizException;
import com.vex.iot.domain.report.ReportConstants;
import com.vex.iot.domain.report.model.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.regex.Pattern;

/// 报表 schema 校验器（严格白名单 + 枚举校验）
@Component
@RequiredArgsConstructor
public class ReportSchemaValidator {

    private static final Pattern ALIAS_PATTERN = Pattern.compile("^[A-Za-z_][A-Za-z0-9_]{0,63}$");

    private final ReportFieldWhitelist whitelist;

    /// 校验完整 schema
    public void validate(ReportSchema schema) {
        validateNullable(schema);
        validateVersion(schema.getSchemaVersion());
        validateSource(schema.getSource());
        validateJoins(schema.getJoins());
        validateColumns(schema.getColumns(), schema.getSource(), schema.getBreakout());
        validateBreakout(schema.getBreakout(), schema.getSource(), schema.getColumns());
        validateSort(schema.getSort());
        validateLimit(schema.getLimit());
    }

    /// 校验 schema JSON 字符串大小
    public void validateSchemaJson(String json) {
        if (json != null && json.getBytes().length > ReportConstants.MAX_SCHEMA_BYTES) {
            throw new BizException("report_schema_too_large", "报表 schema 超过 64KB 限制");
        }
    }

    private void validateNullable(ReportSchema schema) {
        if (schema == null) throw new BizException("report_invalid_schema", "schema 不能为空");
        if (schema.getSource() == null) throw new BizException("report_invalid_schema", "source 不能为空");
    }

    private void validateVersion(String version) {
        if (version == null || version.isBlank() || !ReportConstants.SCHEMA_VERSION_1_0.equals(version)) {
            throw new BizException("report_unsupported_schema_version",
                    "不支持的 schema 版本: " + version + ", 仅支持: " + ReportConstants.SCHEMA_VERSION_1_0);
        }
    }

    private void validateSource(ReportDataSource source) {
        if (source == null) throw new BizException("report_unsupported_source", "数据源不能为空");
        if (source == ReportDataSource.DEVICE) { /* OK */ } else if (source != ReportDataSource.POINT_HISTORY && source != ReportDataSource.POINT_REALTIME) {
            throw new BizException("report_unsupported_source", "不支持的数据源: " + source);
        }
    }

    private void validateJoins(List<Object> joins) {
        if (joins != null && !joins.isEmpty()) {
            throw new BizException("report_unsupported_joins", "本期不支持显式 JOIN");
        }
    }

    private void validateColumns(List<ReportColumnDef> columns, ReportDataSource schemaSource, ReportBreakout breakout) {
        if (columns == null || columns.isEmpty() || columns.size() > ReportConstants.MAX_COLUMNS) {
            throw new BizException("report_columns_out_of_range",
                    "列数必须在 1~" + ReportConstants.MAX_COLUMNS + " 之间");
        }
        Set<String> displayNames = new HashSet<>();
        for (ReportColumnDef col : columns) {
            if (col.getDisplayName() == null || col.getDisplayName().isBlank()) {
                throw new BizException("report_invalid_schema", "列显示名称不能为空");
            }
            if (!displayNames.add(col.getDisplayName())) {
                throw new BizException("report_invalid_schema", "列显示名称重复: " + col.getDisplayName());
            }
            if (col.getSource() == null || col.getField() == null) {
                throw new BizException("report_invalid_schema",
                        "列的 source 和 field 不能为空");
            }
            if (!whitelist.isValid(col.getSource(), col.getField())) {
                throw new BizException("report_invalid_schema",
                        "字段不在白名单中: " + col.getSource() + "." + col.getField());
            }
            validateAgg(col);
            validateOp(col);
        }
    }

    private void validateAgg(ReportColumnDef col) {
        if (col.getAgg() == null) col.setAgg(ReportAggFunc.NONE);
        ReportAggFunc agg = col.getAgg();
        if (agg != ReportAggFunc.NONE && agg != ReportAggFunc.COUNT && agg != ReportAggFunc.COUNT_DISTINCT) {
            if (!whitelist.isNumeric(col.getField())) {
                throw new BizException("report_agg_not_applicable",
                        "聚合函数 " + agg + " 不适用于字段: " + col.getField());
            }
        }
    }

    private void validateOp(ReportColumnDef col) {
        if (col.getOp() != null && col.getOperand() == null) {
            throw new BizException("report_operand_required",
                    "运算符 " + col.getOp() + " 不为 null 时 operand 不能为空");
        }
        if (col.getOp() == null && col.getOperand() != null) {
            throw new BizException("report_operand_required",
                    "operand 不为 null 时运算符不能为空");
        }
        if (col.getOperand() != null) {
            ReportOperand op = col.getOperand();
            if (op.getSource() == null || op.getField() == null) {
                throw new BizException("report_invalid_schema",
                        "operand 的 source 和 field 不能为空");
            }
            if (!whitelist.isValid(op.getSource(), op.getField())) {
                throw new BizException("report_invalid_schema",
                        "operand 字段不在白名单中: " + op.getSource() + "." + op.getField());
            }
            if (op.getAgg() == null) op.setAgg(ReportAggFunc.NONE);
            if (col.getAgg() == ReportAggFunc.NONE && op.getAgg() != ReportAggFunc.NONE) {
                throw new BizException("report_mixed_agg_level",
                        "明细列不能与聚合 operand 运算");
            }
            if (col.getAgg() != ReportAggFunc.NONE && op.getAgg() == ReportAggFunc.NONE) {
                throw new BizException("report_mixed_agg_level",
                        "聚合列不能与明细 operand 运算");
            }
        }
    }

    private void validateBreakout(ReportBreakout breakout, ReportDataSource source, List<ReportColumnDef> columns) {
        if (breakout == null) return;
        if (breakout.getSource() == null || breakout.getField() == null) {
            throw new BizException("report_invalid_schema", "breakout 的 source 和 field 不能为空");
        }
        if (!whitelist.isValid(breakout.getSource(), breakout.getField())) {
            throw new BizException("report_invalid_schema",
                    "breakout 字段不在白名单中: " + breakout.getSource() + "." + breakout.getField());
        }
        boolean hasAgg = columns.stream().anyMatch(c -> c.getAgg() != ReportAggFunc.NONE);
        if (!hasAgg) {
            throw new BizException("report_mixed_agg_level",
                    "有分组时至少需要一个聚合列");
        }
        // 有分组时，每个非分组列必须有聚合函数
        for (ReportColumnDef col : columns) {
            boolean isBreakoutCol = col.getSource() == breakout.getSource()
                    && col.getField().equals(breakout.getField());
            if (!isBreakoutCol && col.getAgg() == ReportAggFunc.NONE) {
                throw new BizException("report_mixed_agg_level",
                        "有分组时列 \"" + col.getDisplayName() + "\" 必须使用聚合函数或作为分组字段");
            }
        }
        boolean breakoutInColumns = columns.stream().anyMatch(c ->
                c.getSource() == breakout.getSource() && c.getField().equals(breakout.getField()));
        if (!breakoutInColumns) {
            throw new BizException("report_breakout_field_not_in_columns",
                    "分组字段必须作为列输出");
        }
    }

    private void validateSort(List<ReportSortItem> sort) {
        if (sort == null || sort.isEmpty()) return;
        if (sort.size() > 5) {
            throw new BizException("report_invalid_schema", "排序字段不能超过 5 个");
        }
        for (ReportSortItem item : sort) {
            if (item.getSource() == null || item.getField() == null) {
                throw new BizException("report_invalid_schema", "排序项的 source 和 field 不能为空");
            }
            if (!whitelist.isValid(item.getSource(), item.getField())) {
                throw new BizException("report_invalid_schema",
                        "排序字段不在白名单中: " + item.getSource() + "." + item.getField());
            }
            if (item.getDirection() == null) {
                item.setDirection(ReportSortDirection.ASC);
            }
        }
    }

    private void validateLimit(Integer limit) {
        if (limit != null && (limit < 1 || limit > ReportConstants.MAX_EXECUTION_LIMIT)) {
            throw new BizException("report_limit_exceeded",
                    "limit 必须在 1~" + ReportConstants.MAX_EXECUTION_LIMIT + " 之间");
        }
    }
}