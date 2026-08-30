package com.vex.iot.domain.alarm.event;

import com.vex.iot.common.enums.AlarmLevel;
import com.vex.iot.common.model.CurrentUser;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/// 报警触发事件
/// AlarmEngine 评估命中后发布,由 NotifyDispatchServer 订阅并发起通知推送。
/// triggerUser 透传触发该报警链路的上下文(设备上行场景下为 CurrentUser.ofDevice 构造的设备身份),
/// 异步订阅方不再依赖 ThreadLocal 的 UserContext。
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AlarmTriggeredEvent {

    /// 触发本次报警链路的上下文(用户 / 设备)
    private CurrentUser triggerUser;

    /// 租户ID
    private String tenantId;

    /// 事件ID
    private String eventId;

    /// 设备ID
    private String deviceId;

    /// 点位编码
    private String pointCode;

    /// 报警级别
    private AlarmLevel level;

    /// 报警消息
    private String message;

    /// 通知用户ID列表
    private List<String> notifyUserIds;
}
