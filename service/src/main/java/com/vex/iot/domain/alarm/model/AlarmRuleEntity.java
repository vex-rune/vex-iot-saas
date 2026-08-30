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

import java.util.List;

/// 报警规则
/// 定义点位数据的报警条件，包括比较方式、阈值、报警级别、通知用户等
@Data
@EqualsAndHashCode(callSuper = false)
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "alarm_rule")
public class AlarmRuleEntity extends BaseEntity {

    /// 报警规则ID（雪花算法生成）
    @Id
    @SnowflakeId
    private String id;

    /// 设备ID
    @Size(max = 64)
    @Column(length = 64)
    private String deviceId;

    /// 点位编码
    @Size(max = 64)
    @Column(length = 64)
    private String pointCode;

    /// 条件类型（gt / ge / lt / le / eq / ne / between）
    @Enumerated(EnumType.STRING)
    private AlarmConditionType conditionType;

    /// 条件中文名称（用户可自定义；为空时回退到 enum.getDisplayName()）
    @Size(max = 64)
    @Column(length = 64)
    private String conditionName;

    /// 阈值（单阈值时使用）
    private Double threshold;

    /// 阈值上限（between 时使用）
    private Double thresholdHigh;

    /// 报警级别
    @Enumerated(EnumType.STRING)
    private AlarmLevel level;

    /// 是否启用
    private boolean enabled;

    /// 通知用户ID列表
    private List<String> notifyUserIds;

    /// 正向公式（用于计算报警值）
    @Size(max = 512)
    @Column(length = 512)
    private String forwardFormula;
}
