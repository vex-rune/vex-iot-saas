package com.vex.iot.domain.device.model;

import com.vex.iot.common.model.SnowflakeId;
import com.vex.iot.common.model.TenantBaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.validation.constraints.Size;
import lombok.*;
import lombok.experimental.SuperBuilder;

/// 设备模版
/// 存储设备配置模版，包含点位、定时控制、面板等配置快照
/// 管理员可从已有设备生成模版，也可手动新建
@EqualsAndHashCode(callSuper = true)
@Data
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "device_template")
public class DeviceTemplateEntity extends TenantBaseEntity {

    /// 模版ID（雪花算法生成）
    @Id
    @SnowflakeId
    private String id;

    /// 模版名称
    @Size(max = 128)
    @Column(length = 128)
    private String templateName;

    /// 模版描述
    @Size(max = 512)
    @Column(length = 512)
    private String description;

    /// 网关类型
    @Column(length = 32)
    private String gatewayType;

    /// 点位配置快照（JSON）
    @Column(columnDefinition = "TEXT")
    private String pointConfig;

    /// 定时控制配置快照（JSON）
    @Column(columnDefinition = "TEXT")
    private String scheduleConfig;

    /// 面板配置快照（JSON）
    @Column(columnDefinition = "TEXT")
    private String panelConfig;

    /// 是否启用
    @Builder.Default
    private boolean enabled = true;
}
