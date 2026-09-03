package com.vex.iot.domain.device.repository;

import com.vex.iot.domain.device.model.DevicePanelEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.transaction.annotation.Transactional;

import java.util.Optional;

/**
 * 设备面板配置 Repository。
 */
public interface DevicePanelRepository extends JpaRepository<DevicePanelEntity, String> {

    /**
     * 按设备 ID 查找面板配置。
     *
     * @param deviceId 设备 ID
     * @return 面板配置（可空）
     */
    Optional<DevicePanelEntity> findByDeviceId(String deviceId);

    /**
     * 按设备 ID 删除面板配置。
     *
     * @param deviceId 设备 ID
     */
    @Modifying
    @Transactional
    void deleteByDeviceId(String deviceId);
}