package com.vex.iot.domain.schedule.model;

import com.vex.iot.common.model.SnowflakeId;
import com.vex.iot.common.model.TenantBaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.validation.constraints.Size;
import lombok.*;
import lombok.experimental.SuperBuilder;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

/**
 * 设备定时控制规则。
 * <p>一条规则在 cron 触发时，会按顺序执行其下所有动作。
 */
@EqualsAndHashCode(callSuper = true)
@Data
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "device_schedule")
public class DeviceScheduleEntity extends TenantBaseEntity {

    /// 规则ID（雪花算法生成）
    @Id
    @SnowflakeId
    private String id;

    /// 所属设备ID
    @Size(max = 64)
    @Column(length = 64)
    private String deviceId;

    /// 规则名称（用户可读）
    @Size(max = 128)
    @Column(length = 128)
    private String name;

    /// Cron 表达式，5 段或 6 段（如 {@code 0 0 8 * * ?}）
    @Size(max = 128)
    @Column(length = 128)
    private String cron;

    /// 是否启用
    @Column(name = "enabled")
    private Boolean enabled;

    /// 备注说明
    @Size(max = 512)
    @Column(length = 512)
    private String description;

    /// 最近一次触发时间（仅记录用，不参与计算）
    @Column(name = "last_fire_at")
    private Instant lastFireAt;

    /// 动作列表（JSON 存储）
    @Column(name = "actions", columnDefinition = "jsonb")
    @Builder.Default
    @JdbcTypeCode(SqlTypes.JSON)
    private List<ScheduleAction> actions = new ArrayList<>();
}
