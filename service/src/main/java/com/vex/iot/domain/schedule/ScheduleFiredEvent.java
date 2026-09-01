package com.vex.iot.domain.schedule;

import com.vex.iot.domain.schedule.model.ScheduleAction;
import lombok.Getter;
import org.springframework.context.ApplicationEvent;

import java.util.List;

/**
 * 定时规则触发事件。
 * <p>
 * 由 ScheduleRuleService 发布，App 层监听并执行业务逻辑。
 * </p>
 *
 * @author Vex
 * @since 1.0
 */
@Getter
public class ScheduleFiredEvent extends ApplicationEvent {

    /// 规则ID
    private final String scheduleId;

    /// 设备ID
    private final String deviceId;

    /// 触发的动作列表
    private final List<ScheduleAction> actions;

    public ScheduleFiredEvent(Object source, String scheduleId, String deviceId,
                              List<ScheduleAction> actions) {
        super(source);
        this.scheduleId = scheduleId;
        this.deviceId = deviceId;
        this.actions = actions;
    }
}
