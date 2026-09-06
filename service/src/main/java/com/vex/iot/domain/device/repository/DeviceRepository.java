package com.vex.iot.domain.device.repository;

import com.vex.iot.domain.device.model.DeviceEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface DeviceRepository extends JpaRepository<DeviceEntity, String> {

    List<DeviceEntity> findByGatewayId(String gatewayId);
    List<DeviceEntity> findByGatewayIdAndEnabled(String gatewayId, boolean enabled);

    List<DeviceEntity> findByTemplateIdAndTemplateSyncEnabled(String templateId, boolean templateSyncEnabled);

}
