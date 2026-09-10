package com.vex.iot.domain.report.repository;

import com.vex.iot.domain.report.model.ReportDefinitionEntity;
import org.springframework.data.jpa.repository.JpaRepository;

/// 报表定义仓储（不写 SQL，沿用 JpaQueriesExecutor）
public interface ReportDefinitionRepository extends JpaRepository<ReportDefinitionEntity, String> {
}
