package com.vex.iot.app;

import com.vex.iot.domain.notify.enums.NotifyChannelType;
import com.vex.iot.domain.notify.enums.NotifyRecordStatus;
import com.vex.iot.domain.alarm.event.AlarmTriggeredEvent;
import com.vex.iot.domain.alarm.model.AlarmLogEntity;
import com.vex.iot.domain.alarm.model.AlarmRuleEntity;
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
        if (event == null) {
            log.error("报警事件或载荷为空，忽略");
            return;
        }


        AlarmTriggeredEvent.AlarmMessage alarmMessage = event.getPayload();
        AlarmRuleEntity rule = alarmMessage.rule();
        AlarmLogEntity alarmLog = alarmMessage.log();

        if (rule == null) {
            log.error("报警事件规则为空，忽略");
            return;
        }

        if (CollectionUtils.isEmpty(rule.getNotifyUserIds())) {
            log.error("报警事件未配置通知人 ruleId={}", rule.getId());
            return;
        }

        List<NotifyUserEntity> users = notifyService.findByTenantIdAndIdIn(rule.getTenantId(), rule.getNotifyUserIds());
        if (users.isEmpty()) {
            log.warn("报警事件通知人档案不存在 ruleId={}", rule.getId());
            return;
        }

        NotifyRecordEntity record = NotifyRecordEntity.builder()
                .tenantId(rule.getTenantId())
                .event(rule.getRuleName())
                .notifyUserIds(users.stream().map(NotifyUserEntity::getId).toList())
                .channel(NotifyChannelType.SMS)
                .status(NotifyRecordStatus.PENDING)
                .content(alarmLog != null ? alarmLog.getMessage() : rule.getMessage())
                .error(null)
                .build();

        notifyService.sendNotify(record);
    }
}
