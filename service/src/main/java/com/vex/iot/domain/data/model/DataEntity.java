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

/// 设备点位历史数据(时序快照)
/// 每条上报值生成一条记录。dataType为快照复制，点位后期修改dataType不会回溯旧历史。
@EqualsAndHashCode(callSuper = true)
@Data
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "data_history")
public class DataEntity extends TenantBaseEntity {

    /// 历史数据ID（雪花算法生成）
    @Id
    @SnowflakeId
    private String id;

    /// 设备ID
    @Size(max = 64)
    @Column(length = 64)
    private String deviceId;

    /// 设备名称
    @Size(max = 64)
    @Column(length = 64)
    private String deviceName;

    /// 点位编码（业务标识，设备内唯一）
    @Size(max = 64)
    @Column(length = 64)
    private String pointCode;

    /// 点位编码（历史兼容字段，与 pointCode 同值）
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

    /// 本条快照数据类型，快照复制点位配置
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
