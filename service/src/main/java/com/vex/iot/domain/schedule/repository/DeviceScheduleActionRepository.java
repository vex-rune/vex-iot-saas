package com.vex.iot.domain.schedule.repository;

import com.vex.iot.domain.schedule.model.DeviceScheduleActionEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface DeviceScheduleActionRepository extends JpaRepository<DeviceScheduleActionEntity, String> {
    List<DeviceScheduleActionEntity> findByScheduleIdOrderBySortOrderAsc(String scheduleId);

    long deleteByScheduleId(String scheduleId);
}
