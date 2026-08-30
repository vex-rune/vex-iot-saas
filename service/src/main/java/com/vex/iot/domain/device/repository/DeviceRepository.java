package com.vex.iot.domain.device.repository;

import com.vex.iot.domain.device.model.DeviceEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface DeviceRepository extends JpaRepository<DeviceEntity, String> {
    Optional<DeviceEntity> findByDeviceCode(String deviceCode);

    Optional<DeviceEntity> findByTenantIdAndDeviceCode(String tenantId, String deviceCode);
}