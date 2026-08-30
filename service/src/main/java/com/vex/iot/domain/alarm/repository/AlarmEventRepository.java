package com.vex.iot.domain.alarm.repository;

import com.vex.iot.domain.alarm.model.AlarmEventEntity;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

/**
 * 告警事件仓储。统一使用方法名派生查询,禁止在 Repository 中书写 SQL/JPQL。
 */
public interface AlarmEventRepository extends JpaRepository<AlarmEventEntity, String> {

    List<AlarmEventEntity> findByTenantIdAndRuleIdAndRecoveredAtIsNull(String tenantId, String ruleId);

    List<AlarmEventEntity> findByRuleIdAndRecoveredAtIsNull(String ruleId);

    /**
     * 告警历史:点位匹配事件 或 全局事件(pointCode 为 null)。
     * Or 前后条件成对传参:tenantId 与 tenantId2、deviceId 与 deviceId2 传相同值。
     */
    List<AlarmEventEntity> findByTenantIdAndDeviceIdAndPointCodeOrTenantIdAndDeviceIdAndPointCodeIsNull(
            String tenantId, String deviceId, String pointCode,
            String tenantId2, String deviceId2, Pageable pageable);

    long countByTenantIdAndRuleIdAndRecoveredAtIsNull(String tenantId, String ruleId);

    long countByRuleIdAndRecoveredAtIsNull(String ruleId);
}
