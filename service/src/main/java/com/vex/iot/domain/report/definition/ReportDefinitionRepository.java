package com.vex.iot.domain.report.definition;

import com.vex.iot.domain.report.model.ReportDefinitionEntity;
import org.springframework.data.jpa.repository.JpaRepository;

/// 报表定义仓储
public interface ReportDefinitionRepository extends JpaRepository<ReportDefinitionEntity, String> {
}