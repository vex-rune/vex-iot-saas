package com.vex.iot.domain.alarm.repository;

import com.vex.iot.domain.alarm.model.PointAlarmEventEntity;
import com.vex.iot.common.enums.EventStatus;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface PointAlarmEventRepository extends JpaRepository<PointAlarmEventEntity, String> {

    List<PointAlarmEventEntity> findByPointDefinitionIdAndEventStatusIn(
            String pointDefinitionId, List<EventStatus> statuses);

    Optional<PointAlarmEventEntity> findByAlarmRuleIdAndEventStatus(String alarmRuleId, EventStatus status);

    List<PointAlarmEventEntity> findByEventStatus(EventStatus status, Pageable pageable);

    long countByEventStatus(EventStatus status);
}
