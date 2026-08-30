package com.vex.iot.domain.pdata.repository;

import com.vex.iot.domain.pdata.model.PointRealtimeEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface PointRealtimeRepository extends JpaRepository<PointRealtimeEntity, String> {

    List<PointRealtimeEntity> findByDeviceId(String deviceId);

    Optional<PointRealtimeEntity> findByDeviceIdAndPointCode(String deviceId, String pointCode);

    Optional<PointRealtimeEntity> findByDeviceCodeAndPointCode(String deviceCode, String pointCode);
}
