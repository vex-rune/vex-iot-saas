package com.vex.iot.domain.alarm.event;

import com.vex.iot.common.enums.AlarmConditionType;
import com.vex.iot.domain.alarm.model.AlarmRuleEntity;
import com.vex.iot.domain.data.model.DataEntity;

import java.math.BigDecimal;

/// 报警文案格式化器 — 集中负责 {@link AlarmTriggeredEvent.AlarmMessage} → 人可读字符串的输出。
///
/// <p>格式：
/// <pre>
/// [{conditionName}] : {deviceName} - {pointId} 当前:[{stringValue}]{unit} {displayName} {threshold}[ {thresholdHigh}]
/// </pre>
///
/// <p>特性：
/// <ul>
///   <li>对 {@code conditionType / conditionName / deviceName / pointId / stringValue / unit / threshold}
///       任一字段为 null 提供兜底，避免 NPE；</li>
///   <li>{@link AlarmConditionType#BETWEEN} 区间条件额外拼接 {@code thresholdHigh}；</li>
///   <li>空单位 {@code unit} 不会拼出多余空格；</li>
///   <li>{@code threshold} 兼容 {@link BigDecimal} / 数字 / 字符串。</li>
/// </ul>
///
/// @author Vex
/// @since 1.0
public final class AlarmMessageFormatter {

    private AlarmMessageFormatter() {
    }

    public static String format(AlarmTriggeredEvent.AlarmMessage message) {
        if (message == null) {
            return "";
        }
        return format(message.rule(), message.data());
    }

    /// 同上，输入分开展开
    public static String format(AlarmRuleEntity rule, DataEntity data) {
        if (rule == null) {
            return data == null ? "" : data.getDeviceName();
        }
        StringBuilder sb = new StringBuilder(128);

        sb.append('[').append(orDash(rule.getConditionName())).append("] : ");
        sb.append(orDash(data == null ? null : data.getDeviceName()))
                .append(" - ")
                .append(orDash(data == null ? null : data.getPointId()))
                .append(" 当前: [")
                .append(orDash(data == null ? null : data.getStringValue()))
                .append(']');

        String unit = data == null ? null : data.getUnit();
        if (unit != null && !unit.isBlank()) {
            sb.append(unit);
        }

        sb.append(' ').append(formatCondition(rule));

        return sb.toString();
    }

    /// 仅条件片段：{@code displayName + threshold + (BETWEEN → high)}。
    public static String formatCondition(AlarmRuleEntity rule) {
        AlarmConditionType type = rule.getConditionType();
        String displayName = (type == null ? null : type.getDisplayName());
        String threshold = stringify(rule.getThreshold());

        if (type == AlarmConditionType.BETWEEN) {
            return threshold + " ~ " + stringify(rule.getThresholdHigh());
        }
        return (displayName == null ? "" : displayName) + threshold;
    }

    /// null-safe 字符串化
    private static String orDash(Object o) {
        return o == null ? "-" : o.toString();
    }

    /// 数字 / BigDecimal / 字符串 统一处理
    private static String stringify(Object value) {
        if (value == null) return "";
        if (value instanceof BigDecimal bd) return bd.toPlainString();
        return value.toString();
    }
}