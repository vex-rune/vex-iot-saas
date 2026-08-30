package com.vex.iot.domain.alarm.model;

import com.vex.iot.common.enums.AlarmAckStatus;
import com.vex.iot.common.enums.AlarmLevel;
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

import java.time.LocalDateTime;

/// 报警事件
/// 记录设备触发报警的具体事件，包含触发时间、恢复时间、确认状态等
@Data
@EqualsAndHashCode(callSuper = false)
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "alarm_event")
public class AlarmEventEntity extends BaseEntity {

    /// 报警事件ID（雪花算法生成）
    @Id
    @SnowflakeId
    private String id;

    /// 设备ID
    @Size(max = 64)
    @Column(length = 64)
    private String deviceId;

    /// 点位编码
    @Size(max = 64)
    @Column(length = 64)
    private String pointCode;

    /// 报警规则ID
    @Size(max = 64)
    @Column(length = 64)
    private String ruleId;

    /// 报警级别
    @Enumerated(EnumType.STRING)
    private AlarmLevel level;

    /// 报警消息
    @Size(max = 512)
    @Column(length = 512)
    private String message;

    /// 确认状态（0-未确认，1-已确认）
    @Enumerated(EnumType.STRING)
    private AlarmAckStatus acknowledged;

    /// 触发时间
    private LocalDateTime triggeredAt;

    /// 恢复时间
    private LocalDateTime recoveredAt;

    /// 确认时间
    private LocalDateTime acknowledgedAt;

    /// 确认人
    @Size(max = 64)
    @Column(length = 64)
    private String acknowledgedBy;
}
