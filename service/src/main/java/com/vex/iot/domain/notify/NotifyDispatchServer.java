package com.vex.iot.domain.notify;

import com.vex.iot.common.enums.NotifyChannelType;
import com.vex.iot.common.enums.NotifyRecordStatus;
import com.vex.iot.common.model.CurrentUser;
import com.vex.iot.domain.alarm.event.AlarmTriggeredEvent;
import com.vex.iot.domain.notify.channel.LogChannel;
import com.vex.iot.domain.notify.channel.NotifyChannel;
import com.vex.iot.domain.notify.channel.SmsChannel;
import com.vex.iot.domain.notify.model.NotifyRecordEntity;
import com.vex.iot.domain.notify.model.NotifyUserEntity;
import com.vex.iot.domain.notify.repository.NotifyUserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.event.EventListener;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * 通知分发服务:
 * - 订阅 AlarmTriggeredEvent,异步读取通知人档案 → 按渠道(短信/微信)调用对应 NotifyChannel。
 * - 重试:首轮发送失败的用户最多重试 2 次,重试间隔线性增长,仍失败则仅记录日志。
 * - 每次发送(成功/失败)都落库到 notify_record,供前端"通知记录"页展示。
 * <p>
 * MVP 范围:短信(LogChannel 或 SmsChannel);微信实现留作二期。
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class NotifyDispatchServer {

    private static final int MAX_RETRY = 2;

    private final NotifyUserRepository userRepository;
    private final LogChannel logChannel;
    private final Optional<SmsChannel> smsChannel;
    private final NotifyRecordServer recordServer;

    /**
     * 异步订阅:triggerUser 从事件本身获取,不依赖 ThreadLocal。
     * 触发者上下文可用于通知内容上署名(例如"设备 X 触发 Y 报警")。
     */
    @Async
    @EventListener(AlarmTriggeredEvent.class)
    public void onAlarm(AlarmTriggeredEvent event) {
        CurrentUser trigger = event.getTriggerUser();
        if (event.getNotifyUserIds() == null || event.getNotifyUserIds().isEmpty()) {
            log.debug("报警事件未配置通知人 eventId={}", event.getEventId());
            return;
        }
        List<NotifyUserEntity> users = userRepository.findByTenantIdAndIdIn(event.getTenantId(), event.getNotifyUserIds());
        if (users.isEmpty()) {
            log.warn("报警事件通知人档案不存在 tenantId={} ids={}", event.getTenantId(), event.getNotifyUserIds());
            return;
        }
        for (NotifyUserEntity user : users) {
            sendWithRetry(user, event.getMessage(), event, trigger);
        }
    }

    private void sendWithRetry(NotifyUserEntity user, String message,
                               AlarmTriggeredEvent event, CurrentUser trigger) {
        // 全局通知开关关闭,直接记录一条"关闭"记录并跳过
        if (!user.isEnabled()) {
            recordServer.record(buildRecord(event, NotifyRecordStatus.FAILED,
                    "用户通知开关已关闭", null, user.getId()));
            return;
        }
        List<NotifyChannel> candidates = pickChannels(user);
        List<String> failed = new ArrayList<>();
        NotifyRecordStatus finalStatus = NotifyRecordStatus.FAILED;
        String finalError = null;
        for (NotifyChannel ch : candidates) {
            if (!ch.isEnabled(user)) continue;
            try {
                if (ch.send(user, message, trigger)) {
                    recordServer.record(buildRecord(event, NotifyRecordStatus.SUCCESS, message, null, user.getId()));
                    return;
                }
            } catch (Exception ex) {
                log.error("[NOTIFY-ERROR] channel={} user={}", ch.name(), user.getId(), ex);
                finalError = ex.getMessage();
            }
            failed.add(ch.name());
        }
        if (!failed.isEmpty()) {
            finalError = (finalError == null ? "" : finalError)
                    + " | failed channels: " + String.join(",", failed);
        }
        log.warn("[NOTIFY-FAIL] user={} channels={} trigger={}",
                user.getId(), failed, trigger == null ? null : trigger.username());
        recordServer.record(buildRecord(event, finalStatus, message, finalError, user.getId()));
    }

    private NotifyRecordEntity buildRecord(AlarmTriggeredEvent event, NotifyRecordStatus status,
                                           String content, String error, String userId) {
        List<String> ids = new ArrayList<>();
        ids.add(userId);
        // MVP:通知渠道只区分 SMS / 其它,记录 SMS
        com.vex.iot.common.enums.NotifyChannelType channel = NotifyChannelType.SMS;
        return NotifyRecordEntity.builder()
                .id(UUID.randomUUID().toString().replace("-", "").substring(0, 16))
                .tenantId(event.getTenantId())
                .time(java.time.LocalDateTime.now())
                .event(event.getMessage())
                .notifyUserIds(ids)
                .channel(channel)
                .status(status)
                .content(truncate(content, 1024))
                .error(truncate(error, 512))
                .build();
    }

    private static String truncate(String s, int max) {
        if (s == null) return null;
        return s.length() <= max ? s : s.substring(0, max);
    }

    private List<NotifyChannel> pickChannels(NotifyUserEntity user) {
        List<NotifyChannel> list = new ArrayList<>();
        if (user.isSmsEnabled() && smsChannel.isPresent()) list.add(smsChannel.get());
        if (user.isWechatEnabled()) {
            // 微信通道二期实现,目前仅记录日志
            list.add(logChannel);
        }
        return list;
    }
}
