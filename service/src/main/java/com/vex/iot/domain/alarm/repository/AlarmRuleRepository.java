package com.vex.iot.domain.alarm.repository;

import com.vex.iot.domain.alarm.model.AlarmRuleEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface AlarmRuleRepository extends JpaRepository<AlarmRuleEntity, String> {
    List<AlarmRuleEntity> findByDeviceIdAndPointCodeAndEnabledTrue(String deviceId, String pointCode);

    List<AlarmRuleEntity> findByDeviceIdAndEnabledTrue(String deviceId);

    List<AlarmRuleEntity> queryByTenantIdAndDeviceIdAndRuleNameLikeAndEnabled(String tenantId, String deviceId, String ruleName, Boolean enabled);
}