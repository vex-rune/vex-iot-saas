package com.vex.iot.domain.pdata.model;

import com.vex.iot.common.enums.PointStatus;
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
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.Instant;
import java.util.List;

/// 设备点位实时快照（一个设备+pointCode唯一一条记录）
/// 保存实时计算结果，不存历史。用于前端实时展示 + 告警引擎即时取样。
@Data
@EqualsAndHashCode(callSuper = false)
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "point_realtime")
public class PointRealtimeEntity extends BaseEntity {

    /// 实时快照主键
    @Id
    @SnowflakeId
    private String id;

    /// 设备ID
    @Size(max = 64)
    @Column(length = 64)
    private String deviceId;

    /// 设备编码
    @Size(max = 64)
    @Column(length = 64)
    private String deviceCode;

    /// 点位编码
    @Size(max = 64)
    @Column(length = 64)
    private String pointCode;

    /// 工程转换后展示值，用于前端展示
    @Size(max = 4096)
    @Column(length = 4096)
    private String value;

    /// 原始采集值
    @Size(max = 4096)
    @Column(length = 4096)
    private String rawValue;

    /// 点位实时状态
    @Enumerated(EnumType.STRING)
    private PointStatus pointStatus;

    /// 当前告警级别 null/NONE/WARN/ERROR
    @Size(max = 16)
    @Column(length = 16)
    private String alarmLevel;

    /// 当前命中的告警规则ID集合，多条规则同时命中存多个id
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "trigger_rule_ids", columnDefinition = "jsonb")
    private List<String> triggerRuleIds;

    /// 设备上报时间戳（设备上报携带）
    private Instant timestamp;

    /// 服务端快照更新时间（服务端生成）
    @Column(name = "updated_at_ts")
    private Instant updatedAtTs;
}
