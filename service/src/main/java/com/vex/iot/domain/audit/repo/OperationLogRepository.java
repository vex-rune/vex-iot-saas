package com.vex.iot.domain.audit.repo;

import com.vex.iot.domain.audit.model.OperationLogEntity;
import org.springframework.data.jpa.repository.JpaRepository;

public interface OperationLogRepository extends JpaRepository<OperationLogEntity, String> {
}