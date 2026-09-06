package com.vex.iot.domain.device.repository;

import com.vex.iot.domain.device.model.DeviceTemplateEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface DeviceTemplateRepository extends JpaRepository<DeviceTemplateEntity, String> {

    /// 按模版名称模糊查询
    List<DeviceTemplateEntity> findByTemplateNameContaining(String templateName);

    /// 按启用状态查询
    List<DeviceTemplateEntity> findByEnabled(boolean enabled);
}
