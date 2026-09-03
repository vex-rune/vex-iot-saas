package com.vex.iot.domain.notify.channel;

import com.vex.iot.domain.notify.model.NotifyUserEntity;

/**
 * 通知渠道抽象:每种渠道实现该接口,由 NotifyDispatchServer 按 channel 选择调用。
 * <p>
 * send 必须返回 true=送达,false=失败(将被记录到失败日志并触发重试)。
 * trigger 透传报警链路的触发者上下文(用户/设备),可用于消息署名。
 */
public interface NotifyChannel {

    /**
     * 渠道标识,与 NotifyUser.smsEnabled / wechatEnabled 旁路字段对齐。
     */
    String name();

    boolean isEnabled(NotifyUserEntity user);

    boolean send(NotifyUserEntity user, String message);
}
