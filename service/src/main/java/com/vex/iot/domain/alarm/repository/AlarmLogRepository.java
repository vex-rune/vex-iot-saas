package com.vex.iot.domain.alarm.repository;

import com.vex.iot.domain.alarm.enums.AlarmAckStatus;
import com.vex.iot.domain.alarm.enums.EventStatus;
import com.vex.iot.domain.alarm.model.AlarmLogEntity;
import org.springframework.data.domain.Pageable;
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

    /// 根据点位定义查询活跃事件
    List<AlarmLogEntity> findByPointDefinitionIdAndEventStatusIn(String pointDefinitionId, List<EventStatus> status);

    /// 根据规则ID和事件状态查询
    java.util.Optional<AlarmLogEntity> findByRuleIdAndEventStatus(String ruleId, EventStatus status);

    /// 根据事件状态查询
    List<AlarmLogEntity> findByEventStatus(EventStatus status, Pageable pageable);

    /// 统计指定状态的事件数量
    long countByEventStatus(EventStatus status);

    /// 查询指定规则在指定时间之后的未确认事件数量（用于重复抑制）
    long countByRuleIdAndAcknowledgedAndTriggeredAtAfter(String ruleId, AlarmAckStatus acknowledged, Instant triggeredAt);

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
}
