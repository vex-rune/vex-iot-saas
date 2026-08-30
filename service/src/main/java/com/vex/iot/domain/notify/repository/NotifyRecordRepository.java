package com.vex.iot.domain.notify.repository;

import com.vex.iot.domain.notify.model.NotifyRecordEntity;
import org.springframework.data.jpa.repository.JpaRepository;

public interface NotifyRecordRepository extends JpaRepository<NotifyRecordEntity, String> {
}
