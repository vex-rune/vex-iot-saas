package com.vex.iot.domain.device.repository;

import com.vex.iot.domain.device.model.PointEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface PointDefinitionRepository extends JpaRepository<PointEntity, String> {
    List<PointEntity> findByTenantIdAndDeviceId(String tenantId, String deviceId);

    List<PointEntity> findByDeviceId(String deviceId);

    Optional<PointEntity> findByDeviceIdAndPointCode(String deviceId, String pointCode);

    long deleteByTenantIdAndDeviceId(String tenantId, String deviceId);

    long deleteByDeviceId(String deviceId);

    List<PointEntity> findByIdIn(List<String> ids);
}
