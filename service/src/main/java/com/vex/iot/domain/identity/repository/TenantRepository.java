package com.vex.iot.domain.identity.repository;

import com.vex.iot.domain.identity.model.TenantEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface TenantRepository extends JpaRepository<TenantEntity, String> {
    Optional<TenantEntity> findByCode(String code);
}
