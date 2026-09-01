package com.vex.iot.domain.notify;

import com.vex.iot.common.enums.NotifyChannelType;
import com.vex.iot.common.enums.NotifyRecordStatus;
import com.vex.iot.common.model.BaseEntity;
import com.vex.iot.common.model.CurrentUser;
import com.vex.iot.common.queries.QueriesPageRequest;
import com.vex.iot.common.queries.jpa.JpaQueriesExecutor;
import com.vex.iot.common.util.IdGenerator;
import com.vex.iot.common.util.UserContext;
import com.vex.iot.domain.alarm.event.AlarmTriggeredEvent;
import com.vex.iot.domain.notify.channel.LogChannel;
import com.vex.iot.domain.notify.channel.NotifyChannel;
import com.vex.iot.domain.notify.channel.SmsChannel;
import com.vex.iot.domain.notify.exception.NotifyTemplateNotFoundException;
import com.vex.iot.domain.notify.model.NotifyRecordEntity;
import com.vex.iot.domain.notify.model.NotifyTemplateEntity;
import com.vex.iot.domain.notify.model.NotifyUserEntity;
import com.vex.iot.domain.notify.repository.NotifyRecordRepository;
import com.vex.iot.domain.notify.repository.NotifyTemplateRepository;
import com.vex.iot.domain.notify.repository.NotifyUserRepository;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.event.EventListener;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * 通知应用层 — 聚合(原 NotifyServer / NotifyRecordServer / NotifyTemplateServer / NotifyDispatchServer)。
 * 四类用例:通知人(user) / 模板(template) / 发送记录(record) / 分发(dispatch)。
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class NotifyService {
    private final NotifyUserRepository userRepository;
    private final NotifyTemplateRepository templateRepository;
    private final NotifyRecordRepository recordRepository;
    private final LogChannel logChannel;
    private final Optional<SmsChannel> smsChannel;

    @PersistenceContext
    private EntityManager entityManager;

    public NotifyUserEntity saveUser(NotifyUserEntity user) {
        LocalDateTime now = LocalDateTime.now();
        String operator = UserContext.username().orElse(BaseEntity.SYSTEM_USER_ID);
        if (user.getId() == null || user.getId().isBlank()) {
            user.setId(IdGenerator.snowId());
            if (user.getTenantId() == null || user.getTenantId().isBlank()) user.setTenantId(BaseEntity.DEFAULT_TENANT_ID);
            user.stampCreated(operator, now);
        } else {
            user.stampUpdated(operator, now);
        }
        return userRepository.save(user);
    }

    public void deleteUser(String id) {
        NotifyUserEntity u = userRepository.findById(id).orElse(null);
        if (u != null) {
            String operator = UserContext.username().orElse(BaseEntity.SYSTEM_USER_ID);
            u.markDeleted(operator, LocalDateTime.now());
            userRepository.save(u);
        }
    }

    public List<NotifyUserEntity> userQuery(QueriesPageRequest req) {
        return JpaQueriesExecutor.of(NotifyUserEntity.class, entityManager).page(req);
    }

    public long userCount(QueriesPageRequest req) {
        return JpaQueriesExecutor.of(NotifyUserEntity.class, entityManager).count(req != null ? req.getPredicate() : null);
    }

    public NotifyTemplateEntity saveTemplate(NotifyTemplateEntity template) {
        LocalDateTime now = LocalDateTime.now();
        String operator = UserContext.username().orElse(BaseEntity.SYSTEM_USER_ID);
        if (template.getId() == null || template.getId().isBlank()) {
            template.setId(IdGenerator.snowId());
            if (template.getTenantId() == null || template.getTenantId().isBlank()) template.setTenantId(BaseEntity.DEFAULT_TENANT_ID);
            template.stampCreated(operator, now);
        } else {
            template.stampUpdated(operator, now);
        }
        return templateRepository.save(template);
    }

    public NotifyTemplateEntity getTemplate(String id) {
        return templateRepository.findById(id).orElseThrow(() -> new NotifyTemplateNotFoundException(id));
    }

    public void deleteTemplate(String id) {
        NotifyTemplateEntity t = templateRepository.findById(id).orElse(null);
        if (t != null) {
            String operator = UserContext.username().orElse(BaseEntity.SYSTEM_USER_ID);
            t.markDeleted(operator, LocalDateTime.now());
            templateRepository.save(t);
        }
    }

    public List<NotifyTemplateEntity> templateQuery(QueriesPageRequest req) {
        return JpaQueriesExecutor.of(NotifyTemplateEntity.class, entityManager).page(req);
    }

    public long templateCount(QueriesPageRequest req) {
        return JpaQueriesExecutor.of(NotifyTemplateEntity.class, entityManager).count(req != null ? req.getPredicate() : null);
    }

    public NotifyRecordEntity saveRecord(NotifyRecordEntity record) {
        LocalDateTime now = LocalDateTime.now();
        String operator = UserContext.username().orElse(BaseEntity.SYSTEM_USER_ID);
        if (record.getId() == null || record.getId().isBlank()) {
            record.setId(IdGenerator.snowId());
            if (record.getTenantId() == null || record.getTenantId().isBlank()) record.setTenantId(BaseEntity.DEFAULT_TENANT_ID);
            record.stampCreated(operator, now);
        }
        if (record.getTime() == null) record.setTime(now);
        return recordRepository.save(record);
    }

    public List<NotifyRecordEntity> recordQuery(QueriesPageRequest req) {
        return JpaQueriesExecutor.of(NotifyRecordEntity.class, entityManager).page(req);
    }

    public long recordCount(QueriesPageRequest req) {
        return JpaQueriesExecutor.of(NotifyRecordEntity.class, entityManager).count(req != null ? req.getPredicate() : null);
    }

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

    private void sendWithRetry(NotifyUserEntity user, String message, AlarmTriggeredEvent event, CurrentUser trigger) {
        if (!user.isEnabled()) {
            saveRecord(buildRecord(event, NotifyRecordStatus.FAILED, "用户通知开关已关闭", null, user.getId()));
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
                    saveRecord(buildRecord(event, NotifyRecordStatus.SUCCESS, message, null, user.getId()));
                    return;
                }
            } catch (Exception ex) {
                log.error("[NOTIFY-ERROR] channel={} user={}", ch.name(), user.getId(), ex);
                finalError = ex.getMessage();
            }
            failed.add(ch.name());
        }
        if (!failed.isEmpty()) {
            finalError = (finalError == null ? "" : finalError) + " | failed channels: " + String.join(",", failed);
        }
        log.warn("[NOTIFY-FAIL] user={} channels={} trigger={}", user.getId(), failed, trigger == null ? null : trigger.username());
        saveRecord(buildRecord(event, finalStatus, message, finalError, user.getId()));
    }

    private NotifyRecordEntity buildRecord(AlarmTriggeredEvent event, NotifyRecordStatus status, String content, String error, String userId) {
        List<String> ids = new ArrayList<>();
        ids.add(userId);
        return NotifyRecordEntity.builder()
                .id(UUID.randomUUID().toString().replace("-", "").substring(0, 16))
                .tenantId(event.getTenantId())
                .time(LocalDateTime.now())
                .event(event.getMessage())
                .notifyUserIds(ids)
                .channel(NotifyChannelType.SMS)
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
        if (user.isWechatEnabled()) list.add(logChannel);
        return list;
    }
}
