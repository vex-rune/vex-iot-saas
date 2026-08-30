package com.vex.iot.domain.notify.repository;

import com.vex.iot.domain.notify.model.NotifyTemplateEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface NotifyTemplateRepository extends JpaRepository<NotifyTemplateEntity, String> {

    /// 按租户和启用状态查询
    List<NotifyTemplateEntity> findByTenantIdAndEnabledTrue(String tenantId);
}
