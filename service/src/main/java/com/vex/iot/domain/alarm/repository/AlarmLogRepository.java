package com.vex.iot.domain.alarm.repository;

import com.vex.iot.domain.alarm.enums.AlarmAckStatus;
import com.vex.iot.domain.alarm.enums.AlarmLevel;
import com.vex.iot.domain.alarm.enums.EventStatus;
import com.vex.iot.domain.alarm.model.AlarmLogEntity;
import org.springframework.data.domain.Limit;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

/**
 * 告警事件仓储。统一使用方法名派生查询,禁止在 Repository 中书写 SQL/JPQL。
 */
public interface AlarmLogRepository extends JpaRepository<AlarmLogEntity, String> {

    /// 查找指定规则最新的活跃未确认告警事件（用于告警聚合递增）
    Optional<AlarmLogEntity> findFirstByRuleIdAndEventStatusAndAcknowledgedOrderByTriggeredAtDesc(
            String ruleId, EventStatus eventStatus, AlarmAckStatus acknowledged);


    @Modifying
    @Query("""
            update AlarmLogEntity a
            set a.eventStatus = :newEventStatus,
                a.acknowledged = :newAckStatus,
                a.acknowledgedAt = :now
            where a.ruleId = :ruleId
            and a.eventStatus = :oldEventStatus
            and a.acknowledged = :oldAckStatus
            """)
    int updateAlarmAckStatus(@Param("ruleId") String ruleId,
                             @Param("oldEventStatus") EventStatus oldEventStatus,
                             @Param("oldAckStatus") AlarmAckStatus oldAckStatus,
                             @Param("newEventStatus") EventStatus newEventStatus,
                             @Param("newAckStatus") AlarmAckStatus newAckStatus,
                             @Param("now") Instant now);


    long countByTenantIdAndDeviceIdAndLevelAndEventStatus(String tenantId, String deviceId, AlarmLevel level, EventStatus eventStatus);

    List<AlarmLogEntity> queryByTenantIdAndDeviceIdAndLevelAndEventStatusOrderByTriggeredAtDesc(String tenantId, String deviceId, AlarmLevel level, EventStatus eventStatus, Limit limit);
}
