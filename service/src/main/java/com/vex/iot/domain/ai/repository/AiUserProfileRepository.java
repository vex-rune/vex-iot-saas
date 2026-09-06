package com.vex.iot.domain.ai.repository;

import com.vex.iot.domain.ai.model.AiUserProfileEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

/**
 * AI 用户画像仓储。
 */
public interface AiUserProfileRepository extends JpaRepository<AiUserProfileEntity, String> {

    Optional<AiUserProfileEntity> findByUserIdAndTenantId(String userId, String tenantId);
}
