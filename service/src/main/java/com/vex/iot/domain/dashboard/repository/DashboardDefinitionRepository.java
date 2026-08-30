package com.vex.iot.domain.dashboard.repository;

import com.vex.iot.common.enums.BizType;
import com.vex.iot.domain.dashboard.model.DashboardDefinitionEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface DashboardDefinitionRepository extends JpaRepository<DashboardDefinitionEntity, String> {

    List<DashboardDefinitionEntity> findByBizTypeAndEnabledTrueOrderBySortOrderAsc(BizType bizType);

    List<DashboardDefinitionEntity> findByDeviceIdAndBizTypeAndEnabledTrueOrderBySortOrderAsc(
            String deviceId, BizType bizType);

    Optional<DashboardDefinitionEntity> findByDeviceIdAndBizTypeAndIsDefaultTrueAndEnabledTrue(
            String deviceId, BizType bizType);
}
