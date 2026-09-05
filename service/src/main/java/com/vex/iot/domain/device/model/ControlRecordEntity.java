package com.vex.iot.domain.device.model;

import com.vex.iot.domain.device.enums.OperationResult;
import com.vex.iot.common.model.SnowflakeId;
import com.vex.iot.common.model.TenantBaseEntity;
import jakarta.persistence.*;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.NoArgsConstructor;
import lombok.experimental.SuperBuilder;

import java.time.Instant;

/// 控制记录
/// 记录平台对设备点位的每一次控制下发操作,用于前端"控制日志"Tab 展示。
/// 与审计域的 {@code ControlLogEntity} 解耦:审计日志面向安全合规,本实体面向业务查询。
@EqualsAndHashCode(callSuper = true)
@Data
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "control_record")
public class ControlRecordEntity extends TenantBaseEntity {

    /// 控制记录ID（雪花算法生成）
    @Id
    @SnowflakeId
    private String id;

    /// 设备ID
    @Size(max = 64)
    @Column(length = 64)
    private String deviceId;

    /// 设备名称
    @Size(max = 128)
    @Column(length = 128)
    private String deviceName;

    /// 点位编码
    @Size(max = 64)
    @Column(length = 64)
    private String pointCode;

    /// 点位名称
    @Size(max = 128)
    @Column(length = 128)
    private String pointName;

    /// 用户输入值（前端传入的原始值）
    @Size(max = 256)
    @Column(length = 256)
    private String inputValue;

    /// 实际写入值（经公式转换后下发到设备的值）
    @Size(max = 256)
    @Column(length = 256)
    private String writtenValue;

    /// 操作人用户名
    @Size(max = 64)
    @Column(length = 64)
    private String username;

    /// 状态（PENDING / SUCCESS / FAIL）
    @Enumerated(EnumType.STRING)
    @Column(length = 16)
    private OperationResult status;

    /// 错误消息（失败时填写）
    @Size(max = 512)
    @Column(length = 512)
    private String errorMessage;

    /// 控制下发时间
    private Instant occurredAt;

    /// 设备回执确认时间（设备上报新值时回填）
    private Instant writtenAt;
}