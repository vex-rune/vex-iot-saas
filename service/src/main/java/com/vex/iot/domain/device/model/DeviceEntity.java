package com.vex.iot.domain.device.model;

import com.vex.iot.domain.device.enums.DeviceOnline;
import com.vex.iot.common.model.SnowflakeId;
import com.vex.iot.common.model.TenantBaseEntity;
import jakarta.persistence.*;
import jakarta.validation.constraints.Size;
import lombok.*;
import lombok.experimental.SuperBuilder;

import java.time.Instant;

/// 设备
/// 记录设备基本信息，包括设备编码、名称、MQTT主题、心跳状态等
@EqualsAndHashCode(callSuper = true)
@Data
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "device")
public class DeviceEntity extends TenantBaseEntity {

    /// 设备ID（雪花算法生成）
    @Id
    @SnowflakeId
    private String id;

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
    @Column(length = 16)
    @Builder.Default
    private DeviceOnline online = DeviceOnline.OFFLINE;

    /// 一级标签
    @Size(max = 64)
    @Column(length = 64)
    private String level1Tag;

    /// 二级标签
    @Size(max = 64)
    @Column(length = 64)
    private String level2Tag;

    /// 三级标签
    @Size(max = 64)
    @Column(length = 64)
    private String level3Tag;

    /// 最后心跳时间
    private Instant lastHeartbeatAt;
}
