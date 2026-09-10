package com.vex.iot.domain.report.engine;

import com.vex.iot.domain.report.model.ReportDataSource;
import org.springframework.stereotype.Component;

import java.util.*;

/// 字段白名单常量（写死，不可运行时扩展）
/// 报表模块安全的核心手段——任何字段拼接到 SQL 前，必须先查到此常量表。
@Component
public class ReportFieldWhitelist {

    /// source → 字段名集合
    private static final Map<ReportDataSource, Set<String>> FIELDS = Map.of(
            ReportDataSource.DEVICE, Set.of(
                    "id", "deviceName", "gatewayId", "gatewayType",
                    "templateId", "enabled", "online",
                    "level1Tag", "level2Tag", "level3Tag",
                    "lastHeartbeatAt", "tenantId"
            ),
            ReportDataSource.POINT_HISTORY, Set.of(
                    "id", "deviceId", "pointId", "pointCode", "pointName",
                    "dataType", "intValue", "doubleValue", "stringValue",
                    "unit", "ts", "ingestedAt", "dataState",
                    "tenantId"
            ),
            ReportDataSource.POINT_REALTIME, Set.of(
                    "id", "deviceId", "pointId", "pointName",
                    "dataType", "intValue", "doubleValue", "stringValue",
                    "unit", "ts", "ingestedAt", "dataState",
                    "tenantId"
            )
    );

    /// 字段 → JPA 实体属性映射
    private static final Map<String, String> FIELD_MAP = Map.of(
            "ts", "timestamp",
            "lastHeartbeatAt", "lastHeartbeatAt",
            "enabled", "enabled",
            "intValue", "intValue",
            "doubleValue", "doubleValue",
            "stringValue", "stringValue"
    );

    /// 数值类型字段（用于聚合校验）
    private static final Set<String> NUMERIC_FIELDS = Set.of(
            "intValue", "doubleValue", "enabled",
            "sortOrder", "precision"
    );

    /// 获取所有 source 枚举值
    public static ReportDataSource[] allSources() {
        return ReportDataSource.values();
    }

    /// 获取 source 下所有合法字段
    public Set<String> getFields(ReportDataSource source) {
        return FIELDS.getOrDefault(source, Set.of());
    }

    /// 校验字段是否合法
    public boolean isValid(ReportDataSource source, String field) {
        return FIELDS.getOrDefault(source, Set.of()).contains(field);
    }

    /// 获取 JPA 属性名（ts → timestamp 等）
    public String getJpaPath(ReportDataSource source, String field) {
        return FIELD_MAP.getOrDefault(field, field);
    }

    /// 判断字段是否为数值类型
    public boolean isNumeric(String field) {
        return NUMERIC_FIELDS.contains(field);
    }
}
