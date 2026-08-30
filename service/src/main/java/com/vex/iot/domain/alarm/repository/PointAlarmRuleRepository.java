package com.vex.iot.domain.alarm.repository;

import com.vex.iot.domain.alarm.model.PointAlarmRuleEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface PointAlarmRuleRepository extends JpaRepository<PointAlarmRuleEntity, String> {

    List<PointAlarmRuleEntity> findByPointDefinitionIdAndEnabledTrue(String pointDefinitionId);

    List<PointAlarmRuleEntity> findByPointDefinitionId(String pointDefinitionId);
}
