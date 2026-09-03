package com.vex.iot.domain.device.repository;

import com.vex.iot.domain.device.model.DeviceEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface DeviceRepository extends JpaRepository<DeviceEntity, String> {

    /**
     * 按网关 ID 查找。预留用于将来多协议场景(当前仅 USR-G771,使用 deviceName 查询)。
     */
    List<DeviceEntity> findByGatewayId(String gatewayId);

    List<DeviceEntity> findByGatewayIdAndEnabled(String gatewayId, boolean enabled);
}
