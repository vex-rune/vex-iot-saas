package com.vex.iot.domain.alarm.model;

import com.vex.iot.common.enums.AlarmConditionType;
import com.vex.iot.common.enums.AlarmLevel;
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

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDateTime;
import java.util.List;

/// 预警规则
/// 统一设备级和点位级的预警规则，通过 source 字段区分来源
@Data
@EqualsAndHashCode(callSuper = false)
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "alarm_rule")
public class AlarmRuleEntity extends BaseEntity {

    /// 预警规则ID
    @Id
    @SnowflakeId
    private String id;

    /// 规则来源：DEVICE-设备级 / POINT-点位级
    @Enumerated(EnumType.STRING)
    @Column(name = "rule_source")
    private AlarmRuleSource source;

    /// 设备ID（设备级规则使用）
    @Size(max = 64)
    @Column(length = 64)
    private String deviceId;

    /// 点位编码（设备级规则使用）
    @Size(max = 64)
    @Column(length = 64)
    private String pointCode;

    /// 点位定义ID（点位级规则使用）
    @Size(max = 64)
    @Column(name = "point_definition_id", length = 64)
    private String pointDefinitionId;

    /// 规则类型：THRESHOLD-阈值 / STATE-状态
    @Enumerated(EnumType.STRING)
    @Column(name = "rule_type")
    private AlarmRuleType ruleType;

    /// 条件类型（阈值规则使用）：GT / GTE / LT / LTE / EQ / NE / BETWEEN
    @Enumerated(EnumType.STRING)
    @Column(name = "condition_type")
    private AlarmConditionType conditionType;

    /// 条件名称（用户可自定义）
    @Size(max = 64)
    @Column(length = 64)
    private String conditionName;

    /// 阈值（单阈值时使用）
    private String threshold;

    /// 阈值上限（BETWEEN 时使用）
    private String thresholdHigh;

    /// 预警级别：INFO / WARN / ERROR
    @Enumerated(EnumType.STRING)
    private AlarmLevel level;

    /// 预警提示文案
    @Size(max = 512)
    @Column(length = 512)
    private String message;

    /// 是否启用
    private Boolean enabled;

    /// 是否屏蔽（检修屏蔽）
    @Column(name = "mask_enable")
    private Boolean maskEnable;

    /// 屏蔽到期时间，null 代表永久屏蔽
    @Column(name = "mask_expire_time")
    private LocalDateTime maskExpireTime;

    /// 通知用户ID列表
    private List<String> notifyUserIds;

    /// 规则来源枚举
    public enum AlarmRuleSource {
        DEVICE,  // 设备级
        POINT    // 点位级
    }

    /// 规则类型枚举
    public enum AlarmRuleType {
        THRESHOLD,  // 阈值
        STATE       // 状态
    }
}
