package com.vex.iot.app;

import com.vex.iot.common.enums.NotifyChannelType;
import com.vex.iot.common.enums.NotifyRecordStatus;
import com.vex.iot.domain.alarm.event.AlarmMessageFormatter;
import com.vex.iot.domain.alarm.event.AlarmTriggeredEvent;
import com.vex.iot.domain.alarm.model.AlarmRuleEntity;
import com.vex.iot.domain.data.model.DataEntity;
import com.vex.iot.domain.notify.NotifyService;
import com.vex.iot.domain.notify.model.NotifyRecordEntity;
import com.vex.iot.domain.notify.model.NotifyUserEntity;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.event.EventListener;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.util.CollectionUtils;

import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class NotifyApp {

    private final NotifyService notifyService;

    @Async
    @EventListener(AlarmTriggeredEvent.class)
    public void onAlarm(AlarmTriggeredEvent event) {
        AlarmTriggeredEvent.AlarmMessage alarmMessage = event.getPayload();
        AlarmRuleEntity rule = alarmMessage.rule();
        DataEntity data = alarmMessage.data();

        if (CollectionUtils.isEmpty(rule.getNotifyUserIds())) {
            log.error("报警事件未配置通知人 eventId={}", rule);
            return;
        }

        List<NotifyUserEntity> users = notifyService.findByTenantIdAndIdIn(rule.getTenantId(), rule.getNotifyUserIds());
        if (users.isEmpty()) {
            log.warn("报警事件通知人档案不存在 rule={}", rule);
            return;
        }

        // 同一条报警的通知文案只生成一次，复用到 event + content 两列
        String message = AlarmMessageFormatter.format(rule, data);

        NotifyRecordEntity record = NotifyRecordEntity.builder()
                .tenantId(rule.getTenantId())
                .event(message)
                .notifyUserIds(users.stream().map(NotifyUserEntity::getId).toList())
                .channel(NotifyChannelType.SMS)
                .status(NotifyRecordStatus.PENDING)
                .content(message)
                .error(null)
                .build();

        notifyService.sendNotify(record);
    }
}
