package com.vex.iot.domain.data.model;

import com.vex.iot.common.enums.DataType;
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

/// 点位最新数据（实时快照）
/// 每个点位（deviceId + pointId）仅保留一条最新记录，用于快速查询当前值。
/// 数据来源：每次设备上报时，更新对应点位的最新数据。
@EqualsAndHashCode(callSuper = true)
@Data
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "data_realtime",
        uniqueConstraints = {
                @UniqueConstraint(
                        name = "uk_point_data_latest_device_point",
                        columnNames = {"deviceId", "pointId"})
        })
public class RealtimeDataEntity extends TenantBaseEntity {

    /// 最新数据ID（雪花算法生成）
    @Id
    @SnowflakeId
    private String id;

    /// 设备ID
    @Size(max = 64)
    @Column(length = 64)
    private String deviceId;

    /// 点位编码（与 DataEntity.pointId 一致）
    @Size(max = 64)
    @Column(length = 64)
    private String pointId;

    /// 点位名称
    @Size(max = 128)
    @Column(length = 128)
    private String pointName;

    /// 单位
    @Size(max = 32)
    @Column(length = 32)
    private String unit;

    /// 数据类型（快照复制点位配置）
    @Enumerated(EnumType.STRING)
    private DataType dataType;

    /// 仅dataType=BOOL/INT使用；bool存0/1；其余填null
    @Column(name = "int_value")
    private Long intValue;

    /// 仅dataType=FLOAT/DOUBLE使用；其余填null
    @Column(name = "double_value")
    private Double doubleValue;

    /// 仅dataType=STRING使用；其余填null
    @Size(max = 4096)
    @Column(name = "string_value", length = 4096)
    private String stringValue;

    /// 该值生效的上报时间戳
    @Column(name = "ts")
    private Instant timestamp;

    /// 服务端入库时间
    @Column(name = "ingested_at")
    private Instant ingestedAt;

    /// 数据状态
    @Enumerated(EnumType.STRING)
    private PointDataState dataState;

}