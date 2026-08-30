package com.vex.iot.domain.device.model;

import com.vex.iot.common.enums.DeviceOnline;
import com.vex.iot.common.model.BaseEntity;
import com.vex.iot.common.model.SnowflakeId;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.validation.constraints.Size;
import lombok.*;
import lombok.experimental.SuperBuilder;

import java.time.LocalDateTime;

/// 设备
/// 记录设备基本信息，包括设备编码、名称、MQTT主题、心跳状态等
@Data
@EqualsAndHashCode(callSuper = false)
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "device")
public class DeviceEntity extends BaseEntity {

    /// 设备ID（雪花算法生成）
    @Id
    @SnowflakeId
    private String id;

    /// 设备编码（全局唯一）
    @Size(max = 64)
    @Column(nullable = false, length = 64)
    private String deviceCode;

    /// 设备名称
    @Size(max = 128)
    @Column(length = 128)
    private String deviceName;

    /// 网关ID
    @Size(max = 64)
    @Column(length = 64)
    private String gatewayId;

    /// 是否启用
    @Builder.Default
    private boolean enabled = true;

    /// 在线状态（0-离线，1-在线）
    @Enumerated(EnumType.STRING)
    @Builder.Default
    private DeviceOnline online = DeviceOnline.OFFLINE;

    /// 最后心跳时间
    private LocalDateTime lastHeartbeatAt;
}
