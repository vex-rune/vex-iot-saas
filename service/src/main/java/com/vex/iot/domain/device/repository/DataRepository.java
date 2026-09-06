package com.vex.iot.domain.device.repository;

import com.vex.iot.domain.device.model.DataEntity;
import org.springframework.data.domain.Limit;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.Instant;
import java.util.List;

/**
 * 点位历史仓储。统一使用方法名派生查询,禁止在 Repository 中书写 SQL/JPQL。
 */
public interface DataRepository extends JpaRepository<DataEntity, String> {
    DataEntity findFirstByPointIdOrderByTimestampDesc(String pointId);

    List<DataEntity> queryByTenantIdAndDeviceNameLikeAndPointNameLikeAndTimestampBetweenOrderByTimestampDesc(
            String tenantId, String deviceName, String pointName, Instant startTime, Instant endTime, Limit of);
}
