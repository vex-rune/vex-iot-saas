package com.vex.iot.domain.alarm.model;

import com.vex.iot.domain.alarm.enums.AlarmAckStatus;
import com.vex.iot.domain.alarm.enums.AlarmLevel;
import com.vex.iot.domain.alarm.enums.EventStatus;
import com.vex.iot.common.model.SnowflakeId;
import com.vex.iot.common.model.TenantBaseEntity;
import jakarta.persistence.*;
import jakarta.validation.constraints.Size;
import lombok.*;
import lombok.experimental.SuperBuilder;

import java.time.Instant;

/// 预警事件
/// 统一设备级和点位级的预警事件记录
@EqualsAndHashCode(callSuper = true)
@Data
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "alarm_event")
public class AlarmLogEntity extends TenantBaseEntity {

    /// 预警事件ID
    @Id
    @SnowflakeId
    private String id;

    /// 事件来源：DEVICE-设备级 / POINT-点位级
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
    @Column(length = 16)
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
    @Column(length = 16)
    private EventStatus eventStatus;

    /// 确认状态（设备级使用）
    @Enumerated(EnumType.STRING)
    @Column(length = 16)
    private AlarmAckStatus acknowledged;

    /// 触发时间
    private Instant triggeredAt;

    /// 发生时间（点位级使用）
    private Instant occurTime;

    /// 恢复时间
    private Instant recoveredAt;

    /// 确认时间
    private Instant acknowledgedAt;

    /// 确认时间（点位级使用）
    private Instant ackTime;

    /// 确认人（设备级使用）
    @Size(max = 64)
    @Column(length = 64)
    private String acknowledgedBy;

    /// 确认操作人ID（点位级使用）
    @Size(max = 64)
    @Column(name = "ack_user_id", length = 64)
    private String ackUserId;

    /// 告警触发次数（防抖聚合：未确认前重复触发仅递增此字段，不发通知）
    @Column(name = "trigger_count")
    @Builder.Default
    private Integer triggerCount = 1;

    public void incrementTriggerCount() {
        triggerCount++;
        triggeredAt = Instant.now();
    }
}
