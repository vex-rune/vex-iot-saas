package com.vex.iot.domain.alarm;

import com.vex.iot.common.enums.AlarmAckStatus;
import com.vex.iot.common.enums.AlarmConditionType;
import com.vex.iot.common.enums.AlarmLevel;
import com.vex.iot.common.enums.EventStatus;
import com.vex.iot.common.exception.BusinessExceptions.NotFoundException;
import com.vex.iot.common.model.TenantBaseEntity;
import com.vex.iot.common.queries.QueriesPageRequest;
import com.vex.iot.common.queries.jpa.JpaQueriesExecutor;
import com.vex.iot.common.util.IdGenerator;
import com.vex.iot.common.util.UserContext;
import com.vex.iot.domain.alarm.event.AlarmMessageFormatter;
import com.vex.iot.domain.alarm.event.AlarmTriggeredEvent;
import com.vex.iot.domain.alarm.exception.AlarmRuleNotFoundException;
import com.vex.iot.domain.alarm.model.AlarmLogEntity;
import com.vex.iot.domain.alarm.model.AlarmRuleEntity;
import com.vex.iot.domain.alarm.repository.AlarmLogRepository;
import com.vex.iot.domain.alarm.repository.AlarmRuleRepository;
import com.vex.iot.domain.data.model.DataEntity;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.lang3.math.NumberUtils;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

/**
 * 预警服务。
 * <p>
 * 统一处理设备级和点位级的预警规则与事件。
 * </p>
 *
 * @author Vex
 * @since 1.0
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class AlarmService {

    private static final int SUPPRESS_WINDOW_MINUTES = 5;
    private final AlarmLogRepository eventRepo;
    private final AlarmRuleRepository ruleRepo;
    private final ApplicationEventPublisher applicationEventPublisher;
    @PersistenceContext
    private EntityManager entityManager;

    /**
     * 保存预警规则。
     */
    public AlarmRuleEntity saveRule(AlarmRuleEntity rule) {
        Instant now = Instant.now();
        String operator = UserContext.username().orElse(TenantBaseEntity.SYSTEM_USER_ID);

        if (rule.getId() == null || rule.getId().isBlank()) {
            rule.setId(IdGenerator.snowId());
            if (rule.getTenantId() == null || rule.getTenantId().isBlank()) {
                rule.setTenantId(TenantBaseEntity.DEFAULT_TENANT_ID);
            }
            rule.stampCreated(operator, now);
        } else {
            rule.stampUpdated(operator, now);
        }
        return ruleRepo.save(rule);
    }

    /**
     * 根据ID获取预警规则。
     */
    public AlarmRuleEntity getRule(String id) {
        return ruleRepo.findById(id)
                .orElseThrow(() -> new AlarmRuleNotFoundException(id));
    }

    /**
     * 删除预警规则。
     */
    public void deleteRule(String id) {
        ruleRepo.deleteById(id);
    }

    /**
     * 分页查询预警规则。
     */
    public List<AlarmRuleEntity> queryRules(QueriesPageRequest req) {
        return JpaQueriesExecutor.of(AlarmRuleEntity.class, entityManager).page(req);
    }

    /**
     * 统计预警规则数量。
     */
    public long countRules(QueriesPageRequest req) {
        return JpaQueriesExecutor.of(AlarmRuleEntity.class, entityManager).count(
                req != null ? req.getPredicate() : null);
    }

    /**
     * 根据设备ID查询启用的预警规则（设备级）。
     */
    public List<AlarmRuleEntity> listEnabledRulesByDevice(String deviceId) {
        return ruleRepo.findByDeviceIdAndEnabledTrue(deviceId);
    }

    /**
     * 根据点位定义ID查询启用的预警规则（点位级）。
     */
    public List<AlarmRuleEntity> listEnabledRulesByPoint(String pointDefinitionId) {
        return ruleRepo.findByPointDefinitionIdAndEnabledTrue(pointDefinitionId);
    }

    /**
     * 分页查询预警事件。
     */
    public List<AlarmLogEntity> queryEvents(QueriesPageRequest req) {
        return JpaQueriesExecutor.of(AlarmLogEntity.class, entityManager).page(req);
    }

    /**
     * 统计预警事件数量。
     */
    public long countEvents(QueriesPageRequest req) {
        return JpaQueriesExecutor.of(AlarmLogEntity.class, entityManager).count(
                req != null ? req.getPredicate() : null);
    }

    /**
     * 确认预警事件（设备级）。
     */
    public AlarmLogEntity acknowledgeEvent(String id) {
        AlarmLogEntity e = eventRepo.findById(id)
                .orElseThrow(() -> new NotFoundException("预警事件"));
        e.setEventStatus(EventStatus.ACK);
        e.setAcknowledged(AlarmAckStatus.ACK);
        e.setAcknowledgedAt(Instant.now());
        e.setAcknowledgedBy(UserContext.username().orElse(null));
        return eventRepo.save(e);
    }

    public void publishAlarm(AlarmRuleEntity rule, String rawValue, DataEntity data) {
        // 报警重复抑制
        if (isAlarmSuppressed(rule, data.getTimestamp())) {
            return;
        }

        if (!rule.getEnabled()) {
            return;
        }

        // 创建报警记录
        AlarmLogEntity event = AlarmLogEntity.builder()
                .id(IdGenerator.snowId())
                .source(AlarmRuleEntity.AlarmRuleSource.DEVICE)
                .deviceId(rule.getDeviceId())
                .pointCode(rule.getPointCode())
                .pointCode(rule.getPointDefinitionId())
                .ruleId(rule.getId())
                .level(rule.getLevel() == null ? AlarmLevel.WARNING : rule.getLevel())
                .message(buildAlarmMessage(rule, rawValue))
                .triggerValue(rawValue)
                .acknowledged(AlarmAckStatus.UNACK)
                .triggeredAt(data.getTimestamp())
                .build();

        // 插入数据
        eventRepo.save(event);

        // 生成message;

        // 发送事件
        applicationEventPublisher.publishEvent(
                new AlarmTriggeredEvent(
                        rule,
                        data,
                        AlarmMessageFormatter.format(rule, data)
                )
        );
    }

    private boolean isAlarmSuppressed(AlarmRuleEntity rule, Instant timestamp) {
        Instant since = timestamp.minusSeconds(SUPPRESS_WINDOW_MINUTES * 60L);
        long recentCount = eventRepo.countByRuleIdAndAcknowledgedAndTriggeredAtAfter(
                rule.getId(), AlarmAckStatus.UNACK, since);
        if (recentCount > 0) {
            log.debug("规则[{}]在{}分钟内已有未确认告警，抑制重复报警", rule.getId(), SUPPRESS_WINDOW_MINUTES);
            return true;
        }
        return false;
    }

    public void recoverAlarm(AlarmRuleEntity rule) {
        eventRepo.updateAlarmAckStatus(
                rule.getId(),
                EventStatus.ACTIVE,
                AlarmAckStatus.UNACK,
                EventStatus.RECOVERED,
                AlarmAckStatus.ACK,
                Instant.now()
        );
    }


    /**
     * 构建报警消息。
     */
    private String buildAlarmMessage(AlarmRuleEntity rule, String rawValue) {
        StringBuilder sb = new StringBuilder();
        sb.append("点位[").append(rule.getPointCode()).append("]");
        sb.append("当前值[").append(rawValue).append("]");
        sb.append("触发条件[").append(formatCondition(rule)).append("]");
        return sb.toString();
    }


    /**
     * 格式化条件描述。
     */
    private String formatCondition(AlarmRuleEntity rule) {
        return switch (rule.getConditionType()) {
            case GT -> AlarmConditionType.GT.getDisplayName() + rule.getThreshold();
            case GE -> AlarmConditionType.GE.getDisplayName() + rule.getThreshold();
            case LT -> AlarmConditionType.LT.getDisplayName() + rule.getThreshold();
            case LE -> AlarmConditionType.LE.getDisplayName() + rule.getThreshold();
            case EQ -> AlarmConditionType.EQ.getDisplayName() + rule.getThreshold();
            case NE -> AlarmConditionType.NE.getDisplayName() + rule.getThreshold();
            case BETWEEN -> rule.getThreshold() + " ~ " + rule.getThresholdHigh();
            default -> "未知";
        };
    }

    public BigDecimal convertToNumeric(String rawValue) {
        if (rawValue == null || rawValue.isBlank()) {
            return null;
        }
        String trimStr = rawValue.trim();
        return new BigDecimal(trimStr);
    }


    /**
     * 检查点位值是否异常。
     */
    public boolean checkAbnormal(AlarmRuleEntity rule, BigDecimal value) {
        String threshold = rule.getThreshold();

        if (!NumberUtils.isCreatable(threshold)) {
            return false;
        }

        BigDecimal thresholdValue = BigDecimal.valueOf(Double.parseDouble(threshold));


        if (rule.getConditionType() == null) {
            return false;
        }


        return switch (rule.getConditionType()) {
            case GT -> value.compareTo(thresholdValue) > 0;
            case GE -> value.compareTo(thresholdValue) >= 0;
            case LT -> value.compareTo(thresholdValue) < 0;
            case LE -> value.compareTo(thresholdValue) <= 0;
            case EQ -> value.compareTo(thresholdValue) == 0;
            case NE -> value.compareTo(thresholdValue) != 0;
            case BETWEEN ->
                    value.compareTo(thresholdValue) >= 0 && value.compareTo(BigDecimal.valueOf(Double.parseDouble(rule.getThresholdHigh()))) <= 0;
        };
    }
}
