package com.vex.iot.domain.alarm;

import com.vex.iot.common.exception.NotFoundException;
import com.vex.iot.common.model.TenantBaseEntity;
import com.vex.iot.common.queries.QueriesPageRequest;
import com.vex.iot.common.queries.jpa.JpaQueriesExecutor;
import com.vex.iot.common.util.IdGenerator;
import com.vex.iot.common.util.UserContext;
import com.vex.iot.domain.alarm.enums.AlarmAckStatus;
import com.vex.iot.domain.alarm.enums.AlarmLevel;
import com.vex.iot.domain.alarm.enums.EventStatus;
import com.vex.iot.domain.alarm.event.AlarmTriggeredEvent;
import com.vex.iot.domain.alarm.exception.AlarmRuleNotFoundException;
import com.vex.iot.domain.alarm.model.AlarmLogEntity;
import com.vex.iot.domain.alarm.model.AlarmRuleEntity;
import com.vex.iot.domain.alarm.repository.AlarmLogRepository;
import com.vex.iot.domain.alarm.repository.AlarmRuleRepository;
import com.vex.iot.domain.alarm.suppress.AlarmSuppressResult;
import com.vex.iot.domain.alarm.suppress.AlarmSuppressStrategy;
import com.vex.iot.domain.alarm.suppress.AlarmSuppressStrategyFactory;
import com.vex.iot.domain.alarm.suppress.AlarmSuppressType;
import com.vex.iot.domain.device.model.DataEntity;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import jakarta.validation.constraints.Size;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.lang3.math.NumberUtils;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.data.domain.Limit;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Optional;

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

    private final AlarmLogRepository eventRepo;
    private final AlarmRuleRepository ruleRepo;
    private final ApplicationEventPublisher applicationEventPublisher;
    private final AlarmSuppressStrategyFactory suppressStrategyFactory;
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
     * 分页查询预警规则。
     */
    public List<AlarmRuleEntity> queryRules(
            String tenantId,
            String deviceId,
            String ruleName,
            Boolean enabled) {
        return ruleRepo.queryByTenantIdAndDeviceIdAndRuleNameLikeAndEnabled(
                tenantId, deviceId, "%" + ruleName + "%", enabled
        );
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
    public List<AlarmRuleEntity> listEnabledRulesByPoint(String deviceId, @Size(max = 64) String pointCode) {
        return ruleRepo.findByDeviceIdAndPointCodeAndEnabledTrue(deviceId, pointCode);
    }

    /**
     * 分页查询预警事件。
     */
    public List<AlarmLogEntity> queryEvents(QueriesPageRequest req) {
        return JpaQueriesExecutor.of(AlarmLogEntity.class, entityManager).page(req);
    }

    /**
     * 分页查询预警事件。
     */
    public List<AlarmLogEntity> queryEvents(
            String tenantId,
            String deviceId,
            AlarmLevel level,
            EventStatus eventStatus) {
        return eventRepo.queryByTenantIdAndDeviceIdAndLevelAndEventStatusOrderByTriggeredAtDesc(tenantId, deviceId, level, eventStatus, Limit.of(20));
    }

    /**
     * 统计预警事件数量。
     */
    public long countEvents(QueriesPageRequest req) {
        return JpaQueriesExecutor.of(AlarmLogEntity.class, entityManager).count(
                req != null ? req.getPredicate() : null);
    }

    /**
     * 统计预警事件数量。
     */
    public long countEvents(
            String tenantId,
            String deviceId,
            AlarmLevel level,
            EventStatus eventStatus) {
        return eventRepo.countByTenantIdAndDeviceIdAndLevelAndEventStatus(tenantId, deviceId, level, eventStatus);
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

    public void publishAlarm(AlarmRuleEntity rule, DataEntity data) {
        if (!rule.getEnabled()) {
            return;
        }

        // 根据规则配置获取抑制策略
        AlarmSuppressType suppressType = rule.getSuppressType() != null
                ? rule.getSuppressType() : AlarmSuppressType.COOLDOWN_AGGREGATE;
        AlarmSuppressStrategy strategy = suppressStrategyFactory.getStrategy(suppressType);

        // 执行策略
        AlarmSuppressResult result = strategy.handle(rule, data);

        if (result.suppressed()) {
            // 完全抑制，不做任何操作
            return;
        }

        if (!result.shouldNotify()) {
            // 聚合模式：已递增次数，不发通知
            return;
        }

        AlarmLogEntity logEntity = result.event();

        // 发布事件
        applicationEventPublisher.publishEvent(new AlarmTriggeredEvent(rule, data, logEntity));

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
            case BETWEEN -> {
                if (rule.getThresholdHigh() == null || !NumberUtils.isCreatable(rule.getThresholdHigh())) {
                    yield false;
                }
                BigDecimal highValue = BigDecimal.valueOf(Double.parseDouble(rule.getThresholdHigh()));
                yield value.compareTo(thresholdValue) >= 0 && value.compareTo(highValue) <= 0;
            }
        };
    }

    public Optional<AlarmLogEntity> findActiveUnackById(String id) {
        return eventRepo.findFirstByRuleIdAndEventStatusAndAcknowledgedOrderByTriggeredAtDesc(id, EventStatus.ACTIVE, AlarmAckStatus.UNACK);
    }

    public void saveLog(AlarmLogEntity alarm) {
        eventRepo.save(alarm);
    }
}
