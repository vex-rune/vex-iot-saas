package com.vex.iot.domain.alarm;

import com.vex.iot.domain.alarm.event.AlarmTriggeredEvent;
import com.vex.iot.domain.alarm.model.AlarmEventEntity;
import com.vex.iot.domain.alarm.model.AlarmRuleEntity;
import com.vex.iot.domain.alarm.repository.AlarmEventRepository;
import com.vex.iot.domain.alarm.repository.AlarmRuleRepository;
import com.vex.iot.common.enums.AlarmAckStatus;
import com.vex.iot.common.enums.AlarmLevel;
import com.vex.iot.common.model.CurrentUser;
import com.vex.iot.common.util.IdGenerator;
import com.vex.iot.domain.pdata.FormulaEngine;
import com.vex.iot.domain.pdata.event.PointValueSnapshot;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.context.event.EventListener;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Slf4j
@Service
@RequiredArgsConstructor
public class AlarmEngine {

    private final AlarmRuleRepository ruleRepository;
    private final AlarmEventRepository eventRepository;
    private final ApplicationEventPublisher eventPublisher;

    /**
     * 当前快照的触发者(透传报警事件使用)。
     */
    public static CurrentUser triggerUserOf(PointValueSnapshot snap) {
        return snap.getTriggerUser();
    }

    /**
     * 异步订阅:不再依赖 ThreadLocal 的 UserContext,triggerUser 从事件本身获取。
     */
    @Async
    @EventListener(PointValueSnapshot.class)
    public void onPointSnapshot(PointValueSnapshot snap) {
        try {
            evaluate(snap);
        } catch (Exception ex) {
            log.error("报警引擎处理失败 deviceCode={}", snap.getDeviceCode(), ex);
        }
    }

    private void evaluate(PointValueSnapshot snap) {
        List<AlarmRuleEntity> rules = ruleRepository.findByDeviceIdAndEnabledTrue(snap.getDeviceId());
        if (rules.isEmpty()) return;

        for (AlarmRuleEntity rule : rules) {
            String raw = snap.getValues().get(rule.getPointCode());
            if (raw == null) continue;
            Double numeric = toNumeric(rule, raw);
            if (numeric == null) {
                log.warn("点位无法转换为数值,跳过评估 ruleId={} point={} raw={}",
                        rule.getId(), rule.getPointCode(), raw);
                continue;
            }

            boolean abnormal = isAbnormal(rule, numeric);
            long activeCount = eventRepository.countByRuleIdAndRecoveredAtIsNull(rule.getId());

            if (abnormal) {
                if (activeCount > 0) {
                    log.debug("报警重复抑制 ruleId={} deviceId={}", rule.getId(), snap.getDeviceId());
                    continue;
                }
                LocalDateTime now = LocalDateTime.now();
                String operator = snap.getTriggerUser() == null
                        ? com.vex.iot.common.model.BaseEntity.SYSTEM_USER_ID
                        : snap.getTriggerUser().username();
                AlarmEventEntity event = AlarmEventEntity.builder()
                        .id(IdGenerator.snowId())
                        .deviceId(snap.getDeviceId())
                        .pointCode(rule.getPointCode())
                        .ruleId(rule.getId())
                        .level(rule.getLevel() == null ? AlarmLevel.WARNING : rule.getLevel())
                        .message(buildMessage(rule, numeric, raw))
                        .acknowledged(AlarmAckStatus.UNACK)
                        .triggeredAt(now)
                        .build();
                event.setTenantId(snap.getTenantId());
                event.stampCreated(operator, now);
                eventRepository.save(event);
                log.warn("报警触发 ruleId={} deviceId={} point={} value={} level={}",
                        rule.getId(), snap.getDeviceId(), rule.getPointCode(), numeric, event.getLevel());
                eventPublisher.publishEvent(AlarmTriggeredEvent.builder()
                        .triggerUser(snap.getTriggerUser())
                        .tenantId(snap.getTenantId())
                        .eventId(event.getId())
                        .deviceId(snap.getDeviceId())
                        .pointCode(rule.getPointCode())
                        .level(event.getLevel())
                        .message(event.getMessage())
                        .notifyUserIds(rule.getNotifyUserIds() == null ? List.of() : rule.getNotifyUserIds())
                        .build());
            } else if (activeCount > 0) {
                LocalDateTime now = LocalDateTime.now();
                String operator = snap.getTriggerUser() == null
                        ? com.vex.iot.common.model.BaseEntity.SYSTEM_USER_ID
                        : snap.getTriggerUser().username();
                eventRepository.findByRuleIdAndRecoveredAtIsNull(rule.getId())
                        .forEach(e -> {
                            e.setRecoveredAt(now);
                            e.stampUpdated(operator, now);
                            eventRepository.save(e);
                            log.info("报警恢复 ruleId={} deviceId={} point={} value={}",
                                    rule.getId(), snap.getDeviceId(), rule.getPointCode(), numeric);
                        });
            }
        }
    }

    private boolean isAbnormal(AlarmRuleEntity rule, Double value) {
        if (rule.getConditionType() == null || rule.getThreshold() == null) return false;
        return switch (rule.getConditionType()) {
            case GT -> value > rule.getThreshold();
            case LT -> value < rule.getThreshold();
            case EQ -> Double.compare(value, rule.getThreshold()) == 0;
            case BETWEEN -> rule.getThresholdHigh() != null
                    && value >= rule.getThreshold() && value <= rule.getThresholdHigh();
            default -> false;
        };
    }

    private Double toNumeric(AlarmRuleEntity rule, String raw) {
        try {
            if (rule.getForwardFormula() != null && !rule.getForwardFormula().isBlank()) {
                Object display = FormulaEngine.forward(rule.getForwardFormula(), raw);
                if (display instanceof Number n) return n.doubleValue();
                return Double.parseDouble(String.valueOf(display));
            }
            return Double.parseDouble(raw);
        } catch (Exception ex) {
            log.warn("公式转换失败 ruleId={} formula={} raw={}",
                    rule.getId(), rule.getForwardFormula(), raw, ex);
            return null;
        }
    }

    private String buildMessage(AlarmRuleEntity rule, Double value, String raw) {
        Map<String, Object> ctx = new HashMap<>();
        ctx.put("point", rule.getPointCode());
        ctx.put("raw", raw);
        ctx.put("value", value);
        ctx.put("condition", rule.getConditionType());
        ctx.put("threshold", rule.getThreshold());
        if (rule.getThresholdHigh() != null) ctx.put("thresholdHigh", rule.getThresholdHigh());
        return ctx.toString();
    }
}
