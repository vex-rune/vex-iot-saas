package com.vex.iot.domain.audit.repo;

import com.vex.iot.domain.audit.model.ControlLogEntity;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ControlLogRepository extends JpaRepository<ControlLogEntity, String> {
}