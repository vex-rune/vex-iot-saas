package com.vex.iot.domain.audit.model;

import com.vex.iot.common.enums.OperationResult;
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

/// 控制日志
/// 点位控制日志:与 OperationLog 解耦,避免审计表过大;
/// 仅记录控制下发(deviceId/pointCode/下发值/操作人/结果)。
/// occurredAt 字段保留业务语义(事件发生时间),由 BaseEntity 审计字段提供数据生命周期时间。
@Data
@EqualsAndHashCode(callSuper = false)
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "control_log")
public class ControlLogEntity extends BaseEntity {

    /// 控制日志ID（雪花算法生成）
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

    /// 输入值
    @Size(max = 256)
    @Column(length = 256)
    private String inputValue;

    /// 写入值
    @Size(max = 256)
    @Column(length = 256)
    private String writtenValue;

    /// 操作人用户名
    @Size(max = 64)
    @Column(length = 64)
    private String username;

    /// 状态（SUCCESS / FAIL）
    @Enumerated(EnumType.STRING)
    private OperationResult status;

    /// 错误消息
    @Size(max = 512)
    @Column(length = 512)
    private String errorMessage;

    /// 发生时间
    private LocalDateTime occurredAt;
}
