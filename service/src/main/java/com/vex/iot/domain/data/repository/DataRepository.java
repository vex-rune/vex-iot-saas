package com.vex.iot.domain.data.repository;

import com.vex.iot.domain.data.model.DataEntity;
import org.springframework.data.jpa.repository.JpaRepository;

/**
 * 点位历史仓储。统一使用方法名派生查询,禁止在 Repository 中书写 SQL/JPQL。
 */
public interface DataRepository extends JpaRepository<DataEntity, String> {
    DataEntity findFirstByPointIdOrderByTimestampDesc(String pointId);
}
