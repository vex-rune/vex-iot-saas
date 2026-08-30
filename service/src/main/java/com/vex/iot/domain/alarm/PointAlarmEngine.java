package com.vex.iot.domain.alarm;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.vex.iot.domain.alarm.model.PointAlarmEventEntity;
import com.vex.iot.domain.alarm.model.PointAlarmRuleEntity;
import com.vex.iot.common.enums.CompareOperator;
import com.vex.iot.common.enums.PointStatus;
import com.vex.iot.common.enums.PointRuleType;
import com.vex.iot.domain.pdata.model.PointRealtimeEntity;
import com.vex.iot.domain.device.model.PointDefinitionEntity;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/// 点位告警引擎
/// 数据上报后调用，对每个点位遍历告警规则、防抖、创建/恢复告警事件、更新实时快照状态。
@Slf4j
@Service
@RequiredArgsConstructor
public class PointAlarmEngine {

    private final PointAlarmRuleServer ruleServer;
    private final PointAlarmEventServer eventServer;
    private final ObjectMapper objectMapper;

    /// 点位防抖状态缓存：pointDefinitionId -> 上次条件命中的时间
    private final Map<String, Instant> debounceTracker = new java.util.concurrent.ConcurrentHashMap<>();

    /// 告警级别优先级：数值越大级别越高
    private static final int LEVEL_WARN = 1;
    private static final int LEVEL_ERROR = 2;

    /**
     * 对单个点位执行告警评估。
     *
     * @param pointDef   点位定义
     * @param rawValue   原始上报值
     * @param realtime   该点位实时快照（已更新value/rawValue）
     */
    public void evaluate(PointDefinitionEntity pointDef, String rawValue, PointRealtimeEntity realtime) {

        // 查询该点位所有启用且未屏蔽的规则
        List<PointAlarmRuleEntity> rules = ruleServer.listEnabledByPointDefinition(pointDef.getId());
        List<PointAlarmRuleEntity> activeRules = rules.stream()
                .filter(r -> r.getEnabled() != null && r.getEnabled())
                .filter(r -> !ruleServer.isMasked(r))
                .toList();

        if (activeRules.isEmpty()) {
            realtime.setPointStatus(PointStatus.NORMAL);
            realtime.setAlarmLevel(null);
            realtime.setTriggerRuleIds(null);
            return;
        }

        // 3. 逐条规则计算
        List<String> hitRuleIds = new ArrayList<>();
        int highestPriority = 0;
        String highestLevel = null;

        for (PointAlarmRuleEntity rule : activeRules) {
            if (isRuleHit(rule, rawValue)) {
                hitRuleIds.add(rule.getId());
                int priority = levelPriority(rule.getAlarmLevel());
                if (priority > highestPriority) {
                    highestPriority = priority;
                    highestLevel = rule.getAlarmLevel();
                }
            }
        }

        // 4. 条件命中即触发（无防抖：字段已从 PointDefinition 移除）
        String debounceKey = pointDef.getId();
        if (hitRuleIds.isEmpty()) {
            // 条件不命中：清除防抖状态，恢复已有告警
            debounceTracker.remove(debounceKey);
            recoverActiveEvents(pointDef.getId());
            realtime.setPointStatus(PointStatus.NORMAL);
            realtime.setAlarmLevel(null);
            realtime.setTriggerRuleIds(null);
            return;
        }

        // 条件命中：清防抖状态并立即触发
        debounceTracker.remove(debounceKey);
        triggerAlarm(pointDef, realtime, hitRuleIds, highestLevel);
    }

    /// 保留入口兼容调用方；超时逻辑已迁移到各告警规则自身，超时字段不再由点位定义承担
    public void checkDataExpire(PointDefinitionEntity pointDef, PointRealtimeEntity realtime) {
        // no-op: dataExpireSeconds 字段已从 PointDefinition 移除
    }

    // ==================== 内部方法 ====================

    /// 触发告警：创建或复用ACTIVE事件，更新实时快照
    private void triggerAlarm(PointDefinitionEntity pointDef, PointRealtimeEntity realtime,
                              List<String> hitRuleIds, String level) {
        for (String ruleId : hitRuleIds) {
            PointAlarmEventEntity existing = eventServer.findActiveByRule(ruleId);
            if (existing == null) {
                PointAlarmEventEntity event = PointAlarmEventEntity.builder()
                        .pointDefinitionId(pointDef.getId())
                        .alarmRuleId(ruleId)
                        .alarmLevel(level)
                        .alarmMessage(findRuleMessage(ruleId))
                        .triggerValue(realtime.getRawValue())
                        .build();
                eventServer.createActive(event);
                log.info("新建告警事件 pointId={} ruleId={} level={}", pointDef.getId(), ruleId, level);
            }
        }
        realtime.setPointStatus(resolvePointStatus(level));
        realtime.setAlarmLevel(level);
        realtime.setTriggerRuleIds(hitRuleIds);
    }

    /// 恢复某点位下所有活跃告警（仅ACTIVE状态，不处理已ACK或已RECOVERED的事件）
    private void recoverActiveEvents(String pointDefinitionId) {
        List<PointAlarmEventEntity> activeEvents = eventServer.listActiveByPointDefinition(pointDefinitionId);
        for (PointAlarmEventEntity event : activeEvents) {
            eventServer.recover(event);
            log.info("告警自动恢复 eventId={} ruleId={}", event.getId(), event.getAlarmRuleId());
        }
    }

    /// 判断单条规则是否命中
    private boolean isRuleHit(PointAlarmRuleEntity rule, String rawValue) {
        if (rawValue == null || rawValue.isBlank()) {
            return false;
        }
        PointRuleType ruleType = rule.getRuleType();
        CompareOperator op = rule.getCompareOperator();
        String threshold = rule.getThresholdValue();

        if (ruleType == PointRuleType.STATE) {
            return evaluateStateRule(op, rawValue, threshold);
        }
        return evaluateThresholdRule(op, rawValue, threshold);
    }

    /// 阈值规则计算
    private boolean evaluateThresholdRule(CompareOperator op, String rawValue, String threshold) {
        try {
            BigDecimal actual = new BigDecimal(rawValue.trim());
            BigDecimal target = new BigDecimal(threshold.trim());
            return switch (op) {
                case GT -> actual.compareTo(target) > 0;
                case GTE -> actual.compareTo(target) >= 0;
                case LT -> actual.compareTo(target) < 0;
                case LTE -> actual.compareTo(target) <= 0;
                case IN, NOT_IN -> false;
            };
        } catch (NumberFormatException e) {
            log.warn("告警规则阈值计算失败: rawValue={}, threshold={}", rawValue, threshold);
            return false;
        }
    }

    /// 状态规则计算：IN/NOT_IN，thresholdValue存JSON数组字符串
    private boolean evaluateStateRule(CompareOperator op, String rawValue, String threshold) {
        try {
            List<String> values = objectMapper.readValue(threshold, new TypeReference<>() {});
            String trimmed = rawValue.trim();
            return switch (op) {
                case IN -> values.contains(trimmed);
                case NOT_IN -> !values.contains(trimmed);
                default -> false;
            };
        } catch (Exception e) {
            log.warn("状态规则解析失败: threshold={}", threshold, e);
            return false;
        }
    }

    /// 告警级别优先级数值：WARN=1, ERROR=2, 其他=0
    private int levelPriority(String level) {
        if ("ERROR".equals(level)) return LEVEL_ERROR;
        if ("WARN".equals(level)) return LEVEL_WARN;
        return 0;
    }

    /// 根据告警级别映射点位状态
    private PointStatus resolvePointStatus(String level) {
        if ("ERROR".equals(level)) return PointStatus.ALARM_HIGH;
        if ("WARN".equals(level)) return PointStatus.WARN_HIGH;
        return PointStatus.NORMAL;
    }

    /// 获取规则的提示文案，异常时记录日志
    private String findRuleMessage(String ruleId) {
        try {
            PointAlarmRuleEntity rule = ruleServer.get(ruleId);
            return rule.getAlarmMessage();
        } catch (Exception e) {
            log.warn("获取告警规则文案失败: ruleId={}", ruleId, e);
            return null;
        }
    }
}
