package com.vex.iot.domain.notify.repository;

import com.vex.iot.domain.notify.model.NotifyUserEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;

public interface NotifyUserRepository extends JpaRepository<NotifyUserEntity, String> {

    List<NotifyUserEntity> findByTenantIdAndIdIn(String tenantId, Collection<String> ids);
}