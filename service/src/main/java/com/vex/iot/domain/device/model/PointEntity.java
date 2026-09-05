package com.vex.iot.domain.device.model;

import com.vex.iot.domain.device.enums.AccessType;
import com.vex.iot.domain.device.enums.DataType;
import com.vex.iot.common.model.SnowflakeId;
import com.vex.iot.common.model.TenantBaseEntity;
import jakarta.persistence.*;
import jakarta.validation.constraints.Size;
import lombok.*;
import lombok.experimental.SuperBuilder;

/// 点位定义
/// 定义设备上的一个监控点，包含点位地址、数据类型、读写权限、报警阈值等配置信息。
@EqualsAndHashCode(callSuper = true)
@Data
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "point_definition",
        uniqueConstraints = {
                @UniqueConstraint(
                        name = "uk_point_def_device_code",
                        columnNames = {"deviceId", "pointCode"})
        })
public class PointEntity extends TenantBaseEntity {

    /// 点位ID（雪花算法生成）
    @Id
    @SnowflakeId
    private String id;

    /// 所属设备ID
    @Size(max = 64)
    @Column(length = 64)
    private String deviceId;

    /// 点位编码（MQTT 数据管道标识，设备内唯一）
    @Size(max = 64)
    @Column(length = 64)
    private String pointCode;

    /// 点位名称
    @Size(max = 128)
    @Column(length = 128)
    private String pointName;

    /// 描述
    @Size(max = 512)
    @Column(length = 512)
    private String description;

    /// 单位
    @Size(max = 32)
    @Column(length = 32)
    private String unit;

    /// 数据类型
    @Enumerated(EnumType.STRING)
    @Column(length = 16)
    private DataType dataType;

    /// 访问类型（只读/读写）
    @Enumerated(EnumType.STRING)
    @Column(length = 16)
    private AccessType access;

    /// 点位排序
    @Column(name = "sort_order")
    private Integer sortOrder;

    /// 自定义分组key，同组key相同，null=未分组
    @Size(max = 64)
    @Column(name = "group_key", length = 64)
    private String groupKey;

    /// 自定义分组展示名称
    @Size(max = 128)
    @Column(name = "group_label", length = 128)
    private String groupLabel;

    /// 值→展示文本字典，序列化为 JSON：{"0":"关","1":"开"}
    /// 主要用于 BOOL/STRING 类型点位；NULL 表示未配置（前端回退到原始值）
    @Column(name = "value_mappings", columnDefinition = "text")
    private String valueMappings;

    /// 数据精度：小数位数（仅 FLOAT/DOUBLE 类型有效）。
    /// 例如 2 表示保留两位小数（3.14），3 表示保留三位（3.142）。
    /// null 或 0 表示不截断（保留原始精度）。
    @Column(name = "precision")
    @Builder.Default
    private Integer precision = 0;


    public Integer getPrecision() {
        return precision == null ? 0 : precision;
    }
}
