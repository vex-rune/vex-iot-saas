package com.vex.iot.domain.dashboard.model;

import com.vex.iot.common.enums.BizType;
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

/// 仪表盘定义
/// bizType=GLOBAL时deviceId=null；DEVICE/DEVICE_DETAIL必须非空。
@Data
@EqualsAndHashCode(callSuper = false)
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "dashboard_definition")
public class DashboardDefinitionEntity extends BaseEntity {

    /// 仪表盘定义主键
    @Id
    @SnowflakeId
    private String id;

    /// 仪表盘名称
    @Size(max = 128)
    @Column(length = 128)
    private String name;

    /// 业务类型
    @Enumerated(EnumType.STRING)
    private BizType bizType;

    /// 关联设备ID；bizType=GLOBAL时为null；DEVICE/DEVICE_DETAIL必须非空
    @Size(max = 64)
    @Column(length = 64)
    private String deviceId;

    /// 仪表盘描述
    @Size(max = 512)
    @Column(length = 512)
    private String description;

    /// 仪表盘排序，数字越小越靠前
    @Column(name = "sort_order")
    private Integer sortOrder;

    /// 是否为该设备默认仪表盘；同一deviceId下bizType=DEVICE_DETAIL最多一个true
    @Column(name = "is_default")
    private Boolean isDefault;

    /// 是否启用该仪表盘；false页面不加载
    @Column(name = "enabled")
    private Boolean enabled;
}
