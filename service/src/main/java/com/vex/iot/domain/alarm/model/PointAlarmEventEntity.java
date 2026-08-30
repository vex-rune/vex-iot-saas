package com.vex.iot.domain.alarm.model;

import com.vex.iot.common.enums.EventStatus;
import com.vex.iot.common.model.BaseEntity;
import com.vex.iot.common.model.SnowflakeId;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.NoArgsConstructor;
import lombok.experimental.SuperBuilder;

import java.time.Instant;

/// 点位告警事件记录
/// 一个点位产生多条告警事件；eventStatus支持 ACTIVE/RECOVERED/ACK 三种状态。
@Data
@EqualsAndHashCode(callSuper = false)
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "point_alarm_event")
public class PointAlarmEventEntity extends BaseEntity {

    /// 告警事件主键
    @Id
    @SnowflakeId
    private String id;

    /// 关联点位定义ID
    @Size(max = 64)
    @Column(length = 64)
    private String pointDefinitionId;

    /// 触发的告警规则ID
    @Size(max = 64)
    @Column(length = 64)
    private String alarmRuleId;

    /// 告警等级 WARN / ERROR
    @Size(max = 16)
    @Column(length = 16)
    private String alarmLevel;

    /// 告警提示文案
    @Size(max = 512)
    @Column(length = 512)
    private String alarmMessage;

    /// 告警触发时刻点位原始值
    @Size(max = 4096)
    @Column(length = 4096)
    private String triggerValue;

    /// 告警事件状态
    @Enumerated(EnumType.STRING)
    private EventStatus eventStatus;

    /// 告警发生时间
    private Instant occurTime;

    /// 告警恢复时间，未恢复为null
    private Instant recoverTime;

    /// 告警确认时间
    private Instant ackTime;

    /// 告警确认操作人ID
    @Size(max = 64)
    @Column(length = 64)
    private String ackUserId;
}
