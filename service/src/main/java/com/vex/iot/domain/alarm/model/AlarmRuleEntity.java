package com.vex.iot.domain.alarm.model;

import com.vex.iot.common.config.IEnum;
import com.vex.iot.domain.alarm.enums.AlarmConditionType;
import com.vex.iot.domain.alarm.enums.AlarmLevel;
import com.vex.iot.common.model.SnowflakeId;
import com.vex.iot.common.model.TenantBaseEntity;
import com.vex.iot.domain.alarm.suppress.AlarmSuppressType;
import jakarta.persistence.*;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.NoArgsConstructor;
import lombok.experimental.SuperBuilder;

import java.time.Instant;
import java.util.List;

/// 预警规则
/// 统一设备级和点位级的预警规则，通过 source 字段区分来源
@EqualsAndHashCode(callSuper = true)
@Data
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "alarm_rule")
public class AlarmRuleEntity extends TenantBaseEntity {

    /// 预警规则ID
    @Id
    @SnowflakeId
    private String id;

    /// 条件名称（用户可自定义）
    @Size(max = 64)
    @Column(length = 64)
    private String ruleName;

    /// 规则来源：DEVICE-设备级 / POINT-点位级
    @Enumerated(EnumType.STRING)
    @Column(length = 16)
    private AlarmRuleSource source;

    /// 设备ID（设备级规则使用）
    @Size(max = 64)
    @Column(length = 64)
    private String deviceId;

    /// 点位编码（设备级规则使用）
    @Size(max = 64)
    @Column(length = 64)
    private String pointCode;

    /// 规则类型：THRESHOLD-阈值 / STATE-状态
    @Enumerated(EnumType.STRING)
    @Column(length = 16)
    private AlarmRuleType ruleType;

    /// 条件类型（阈值规则使用）：GT / GTE / LT / LTE / EQ / NE / BETWEEN
    @Enumerated(EnumType.STRING)
    @Column(length = 16)
    private AlarmConditionType conditionType;


    /// 阈值（单阈值时使用）
    private String threshold;

    /// 阈值上限（BETWEEN 时使用）
    private String thresholdHigh;

    /// 预警级别：INFO / WARN / ERROR
    @Enumerated(EnumType.STRING)
    @Column(length = 16)
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
    private Instant maskExpireTime;

    /// 通知用户ID列表
    private List<String> notifyUserIds;

    /// 告警抑制策略类型（null 时默认 COOLDOWN_AGGREGATE）
    @Enumerated(EnumType.STRING)
    @Column(length = 16)
    private AlarmSuppressType suppressType;

    /// 规则来源枚举
    public enum AlarmRuleSource implements IEnum {
        DEVICE,  // 设备级
        POINT    // 点位级
        ;

        @Override
        public String displayName() {
            return name();
        }
    }

    /// 规则类型枚举
    public enum AlarmRuleType implements IEnum {
        THRESHOLD,  // 阈值
        STATE       // 状态
        ;

        
        @Override
        public String displayName() {
            return name();
        }
    }
}
