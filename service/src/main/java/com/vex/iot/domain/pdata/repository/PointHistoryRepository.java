package com.vex.iot.domain.pdata.repository;

import com.vex.iot.domain.pdata.model.PointHistoryEntity;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

/**
 * 点位历史仓储。统一使用方法名派生查询,禁止在 Repository 中书写 SQL/JPQL。
 */
public interface PointHistoryRepository extends JpaRepository<PointHistoryEntity, String> {

    List<PointHistoryEntity> findByDeviceIdAndPointCodeAndTimestampBetween(
            String deviceId, String pointCode, Instant from, Instant to, Pageable pageable);

    /** from 之前(≤)该点位最后一条变化点,用于补查询区间首点。 */
    Optional<PointHistoryEntity> findFirstByDeviceIdAndPointCodeAndTimestampLessThanEqualOrderByTimestampDesc(
            String deviceId, String pointCode, Instant from);
}
