package com.vex.iot.domain.alarm.event;

import com.vex.iot.domain.alarm.enums.AlarmConditionType;
import com.vex.iot.domain.alarm.model.AlarmRuleEntity;
import com.vex.iot.domain.device.model.DataEntity;

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


    /**
     * 构建报警消息。
     */
    public static String format(AlarmRuleEntity rule, DataEntity data) {
        return "点位[" + data.getPointName() + "]" +
                "当前值[" + data.getStringValue() + "]" +
                "触发条件[" + formatCondition(rule) + "]";
    }


    /**
     * 格式化条件描述。
     */
    private static String formatCondition(AlarmRuleEntity rule) {
        return switch (rule.getConditionType()) {
            case GT -> AlarmConditionType.GT.displayName() + rule.getThreshold();
            case GE -> AlarmConditionType.GE.displayName() + rule.getThreshold();
            case LT -> AlarmConditionType.LT.displayName() + rule.getThreshold();
            case LE -> AlarmConditionType.LE.displayName() + rule.getThreshold();
            case EQ -> AlarmConditionType.EQ.displayName() + rule.getThreshold();
            case NE -> AlarmConditionType.NE.displayName() + rule.getThreshold();
            case BETWEEN -> rule.getThreshold() + " ~ " + rule.getThresholdHigh();
        };
    }
}