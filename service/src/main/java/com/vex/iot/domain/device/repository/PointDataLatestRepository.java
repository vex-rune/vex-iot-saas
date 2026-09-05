package com.vex.iot.domain.device.repository;

import com.vex.iot.domain.device.model.RealtimeDataEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

/**
 * 点位最新数据仓储。统一使用方法名派生查询,禁止在 Repository 中书写 SQL/JPQL。
 */
public interface PointDataLatestRepository extends JpaRepository<RealtimeDataEntity, String> {
    Optional<RealtimeDataEntity> findByDeviceIdAndPointId(String deviceId, String pointId);
}