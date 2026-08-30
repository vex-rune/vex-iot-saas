package com.vex.iot.domain.schedule.repository;

import com.vex.iot.domain.schedule.model.DeviceScheduleEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface DeviceScheduleRepository extends JpaRepository<DeviceScheduleEntity, String> {
    List<DeviceScheduleEntity> findByDeviceId(String deviceId);

    List<DeviceScheduleEntity> findByEnabledTrue();
}
