package com.vex.iot.domain.dashboard.repository;

import com.vex.iot.domain.dashboard.model.DashboardCardEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface DashboardCardRepository extends JpaRepository<DashboardCardEntity, String> {

    List<DashboardCardEntity> findByDashboardIdAndEnabledTrueOrderBySortOrderAsc(String dashboardId);
}
