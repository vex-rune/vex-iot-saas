package com.vex.iot.domain.notify.channel;

import com.vex.iot.domain.notify.model.NotifyUserEntity;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

/**
 * 日志通道:在阿里云短信未配置 / 测试环境兜底使用,所有"发送"仅打印日志。
 */
@Slf4j
@Component
public class LogChannel implements NotifyChannel {

    @Override
    public String name() {
        return "LOG";
    }

    @Override
    public boolean isEnabled(NotifyUserEntity user) {
        return user != null;
    }

    @Override
    public boolean send(NotifyUserEntity user, String message) {
        log.info("[NOTIFY-LOG] user={} phone={} msg={}",
                user.getId(), user.getPhone(), message);
        return true;
    }
}
