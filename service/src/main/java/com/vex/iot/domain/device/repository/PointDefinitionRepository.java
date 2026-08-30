package com.vex.iot.domain.device.repository;

import com.vex.iot.domain.device.model.PointDefinitionEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface PointDefinitionRepository extends JpaRepository<PointDefinitionEntity, String> {
    List<PointDefinitionEntity> findByTenantIdAndDeviceId(String tenantId, String deviceId);

    List<PointDefinitionEntity> findByDeviceId(String deviceId);

    Optional<PointDefinitionEntity> findByDeviceIdAndPointCode(String deviceId, String pointCode);

    long deleteByTenantIdAndDeviceId(String tenantId, String deviceId);

    long deleteByDeviceId(String deviceId);

    List<PointDefinitionEntity> findByIdIn(List<String> ids);
}
