package com.vex.iot.domain.alarm.suppress;

import com.vex.iot.common.config.IEnum;

/// 告警抑制策略类型
public enum AlarmSuppressType implements IEnum {

    /// 不抑制 - 每次触发都生成新告警并通知
    NONE,

    /// 冷却聚合 - 冷却窗口内完全抑制，窗口外递增次数不通知
    COOLDOWN_AGGREGATE,

    /// 滑动窗口 - 固定时间窗口内只通知一次，窗口结束后重置
    SLIDING_WINDOW;

    


    
    @Override
    public String displayName() {
        return name();
    }
}