package com.vex.iot.domain.alarm.suppress;

import com.vex.iot.domain.alarm.model.AlarmRuleEntity;
import com.vex.iot.domain.device.model.DataEntity;

/// 告警抑制策略接口
///
/// 实现类需标注 {@link org.springframework.stereotype.Component}，
/// 由 Spring 自动注入到 {@link AlarmSuppressStrategyFactory} 中。
///
/// @author Vex
/// @since 1.0
public interface AlarmSuppressStrategy {

    /// 获取策略类型
    AlarmSuppressType getType();

    /// 处理告警事件，决定是否抑制、聚合或触发通知
    ///
    /// @param rule      告警规则
    /// @param data      触发数据
    /// @return 处理结果
    AlarmSuppressResult handle(AlarmRuleEntity rule, DataEntity data);
}