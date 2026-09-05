package com.vex.iot.domain.device.repository;

import com.vex.iot.domain.device.enums.OperationResult;
import com.vex.iot.domain.device.model.ControlRecordEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

/**
 * 控制记录仓储。查询走 {@link com.vex.iot.common.queries.jpa.JpaQueriesExecutor} 统一框架。
 */
public interface ControlRecordRepository extends JpaRepository<ControlRecordEntity, String> {

    /**
     * 查找指定设备+点位的 PENDING 状态控制记录（按时间升序）。
     */
    List<ControlRecordEntity> findByDeviceIdAndPointCodeAndStatusOrderByOccurredAtAsc(
            String deviceId, String pointCode, OperationResult status);
}