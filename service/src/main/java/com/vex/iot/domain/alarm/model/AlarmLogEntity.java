package com.vex.iot.domain.alarm.model;

import com.vex.iot.common.enums.AlarmAckStatus;
import com.vex.iot.common.enums.AlarmLevel;
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
import java.time.LocalDateTime;

/// 预警事件
/// 统一设备级和点位级的预警事件记录
@Data
@EqualsAndHashCode(callSuper = false)
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "alarm_event")
public class AlarmLogEntity extends BaseEntity {

    /// 预警事件ID
    @Id
    @SnowflakeId
    private String id;

    /// 事件来源：DEVICE-设备级 / POINT-点位级
    @Enumerated(EnumType.STRING)
    @Column(name = "event_source")
    private AlarmRuleEntity.AlarmRuleSource source;

    /// 设备ID（设备级事件使用）
    @Size(max = 64)
    @Column(length = 64)
    private String deviceId;

    /// 点位编码（设备级事件使用）
    @Size(max = 64)
    @Column(length = 64)
    private String pointCode;

    /// 点位定义ID（点位级事件使用）
    @Size(max = 64)
    @Column(name = "point_definition_id", length = 64)
    private String pointDefinitionId;

    /// 预警规则ID
    @Size(max = 64)
    @Column(name = "rule_id", length = 64)
    private String ruleId;

    /// 预警级别：INFO / WARN / ERROR
    @Enumerated(EnumType.STRING)
    private AlarmLevel level;

    /// 预警消息
    @Size(max = 512)
    @Column(length = 512)
    private String message;

    /// 触发时的原始值
    @Size(max = 4096)
    @Column(name = "trigger_value", length = 4096)
    private String triggerValue;

    /// 事件状态（点位级使用）：ACTIVE / RECOVERED / ACK
    @Enumerated(EnumType.STRING)
    @Column(name = "event_status")
    private EventStatus eventStatus;

    /// 确认状态（设备级使用）
    @Enumerated(EnumType.STRING)
    private AlarmAckStatus acknowledged;

    /// 触发时间
    private LocalDateTime triggeredAt;

    /// 发生时间（点位级使用）
    private LocalDateTime occurTime;

    /// 恢复时间
    private LocalDateTime recoveredAt;

    /// 确认时间
    private LocalDateTime acknowledgedAt;

    /// 确认时间（点位级使用）
    private LocalDateTime ackTime;

    /// 确认人（设备级使用）
    @Size(max = 64)
    @Column(length = 64)
    private String acknowledgedBy;

    /// 确认操作人ID（点位级使用）
    @Size(max = 64)
    @Column(name = "ack_user_id", length = 64)
    private String ackUserId;
}
