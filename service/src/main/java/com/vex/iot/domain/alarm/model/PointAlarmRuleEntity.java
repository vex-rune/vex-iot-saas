package com.vex.iot.domain.alarm.model;

import com.vex.iot.common.enums.CompareOperator;
import com.vex.iot.common.enums.PointRuleType;
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

import java.time.Instant;

/// 点位预警告警规则
/// 一个点位可配置N条规则（高预警、高告警、低预警、低告警、状态告警）。
@Data
@EqualsAndHashCode(callSuper = false)
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "point_alarm_rule")
public class PointAlarmRuleEntity extends BaseEntity {

    /// 预警告警规则主键
    @Id
    @SnowflakeId
    private String id;

    /// 关联点位定义ID
    @Size(max = 64)
    @Column(length = 64)
    private String pointDefinitionId;

    /// 规则类型：高阈值、低阈值、状态
    @Enumerated(EnumType.STRING)
    private PointRuleType ruleType;

    /// 阈值数值；IN/NOT_IN运算符时存入JSON字符串数组，例 ["0","运行"]
    @Size(max = 1024)
    @Column(length = 1024)
    private String thresholdValue;

    /// 比较运算符 > >= < <= 不在集合 在集合
    @Enumerated(EnumType.STRING)
    private CompareOperator compareOperator;

    /// 本规则触发后的告警级别 WARN / ERROR
    @Size(max = 16)
    @Column(length = 16)
    private String alarmLevel;

    /// 本规则触发提示文案
    @Size(max = 512)
    @Column(length = 512)
    private String alarmMessage;

    /// 本条规则是否启用；false本条规则跳过计算
    @Column(name = "enabled")
    private Boolean enabled;

    /// 是否屏蔽本条告警规则（检修屏蔽）；屏蔽后即使条件命中也不产生告警事件
    @Column(name = "mask_enable")
    private Boolean maskEnable;

    /// 屏蔽到期时间，null代表永久屏蔽；maskEnable=true才生效
    @Column(name = "mask_expire_time")
    private Instant maskExpireTime;
}
