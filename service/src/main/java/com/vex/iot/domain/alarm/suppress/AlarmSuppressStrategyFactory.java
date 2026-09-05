package com.vex.iot.domain.alarm.suppress;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

/// 告警抑制策略工厂
///
/// 自动收集所有 {@link AlarmSuppressStrategy} 实现，按类型提供查找能力。
///
/// @author Vex
/// @since 1.0
@Slf4j
@Component
public class AlarmSuppressStrategyFactory {

    private final Map<AlarmSuppressType, AlarmSuppressStrategy> strategyMap;

    public AlarmSuppressStrategyFactory(List<AlarmSuppressStrategy> strategies) {
        this.strategyMap = strategies.stream()
                .collect(Collectors.toMap(AlarmSuppressStrategy::getType, Function.identity()));
        log.info("已注册告警抑制策略: {}", strategyMap.keySet());
    }

    /// 根据策略类型获取策略实现
    ///
    /// @param type 策略类型，null 时默认返回 NONE 策略
    /// @return 策略实现
    public AlarmSuppressStrategy getStrategy(AlarmSuppressType type) {
        if (type == null) {
            type = AlarmSuppressType.NONE;
        }
        AlarmSuppressStrategy strategy = strategyMap.get(type);
        if (strategy == null) {
            log.warn("未找到告警抑制策略[{}]，使用默认策略NONE", type);
            strategy = strategyMap.get(AlarmSuppressType.NONE);
        }
        return strategy;
    }
}