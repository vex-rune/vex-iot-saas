package com.vex.iot.domain.notify;

import com.vex.iot.common.enums.NotifyChannelType;
import com.vex.iot.common.enums.NotifyRecordStatus;
import com.vex.iot.common.model.TenantBaseEntity;
import com.vex.iot.common.queries.QueriesPageRequest;
import com.vex.iot.common.queries.jpa.JpaQueriesExecutor;
import com.vex.iot.common.util.IdGenerator;
import com.vex.iot.common.util.UserContext;
import com.vex.iot.domain.notify.channel.LogChannel;
import com.vex.iot.domain.notify.channel.NotifyChannel;
import com.vex.iot.domain.notify.channel.SmsChannel;
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
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

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

    private static String truncate(String s, int max) {
        if (s == null) return null;
        return s.length() <= max ? s : s.substring(0, max);
    }

    public NotifyUserEntity saveUser(NotifyUserEntity user) {
        Instant now = Instant.now();
        String operator = UserContext.username().orElse(TenantBaseEntity.SYSTEM_USER_ID);
        if (user.getId() == null || user.getId().isBlank()) {
            user.setId(IdGenerator.snowId());
            if (user.getTenantId() == null || user.getTenantId().isBlank())
                user.setTenantId(TenantBaseEntity.DEFAULT_TENANT_ID);
            user.stampCreated(operator, now);
        } else {
            user.stampUpdated(operator, now);
        }
        return userRepository.save(user);
    }

    public void deleteUser(String id) {
        NotifyUserEntity u = userRepository.findById(id).orElse(null);
        if (u != null) {
            String operator = UserContext.username().orElse(TenantBaseEntity.SYSTEM_USER_ID);
            u.markDeleted(operator, Instant.now());
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
        Instant now = Instant.now();
        String operator = UserContext.username().orElse(TenantBaseEntity.SYSTEM_USER_ID);
        if (template.getId() == null || template.getId().isBlank()) {
            template.setId(IdGenerator.snowId());
            if (template.getTenantId() == null || template.getTenantId().isBlank())
                template.setTenantId(TenantBaseEntity.DEFAULT_TENANT_ID);
            template.stampCreated(operator, now);
        } else {
            template.stampUpdated(operator, now);
        }
        return templateRepository.save(template);
    }

    public void deleteTemplate(String id) {
        NotifyTemplateEntity t = templateRepository.findById(id).orElse(null);
        if (t != null) {
            String operator = UserContext.username().orElse(TenantBaseEntity.SYSTEM_USER_ID);
            t.markDeleted(operator, Instant.now());
            templateRepository.save(t);
        }
    }

    public List<NotifyTemplateEntity> templateQuery(QueriesPageRequest req) {
        return JpaQueriesExecutor.of(NotifyTemplateEntity.class, entityManager).page(req);
    }

    public long templateCount(QueriesPageRequest req) {
        return JpaQueriesExecutor.of(NotifyTemplateEntity.class, entityManager).count(req != null ? req.getPredicate() : null);
    }

    public NotifyRecordEntity sendNotify(NotifyRecordEntity record) {
        Instant now = Instant.now();
        String operator = UserContext.username().orElse(TenantBaseEntity.SYSTEM_USER_ID);
        if (record.getId() == null || record.getId().isBlank()) {
            record.setId(IdGenerator.snowId());
            if (record.getTenantId() == null || record.getTenantId().isBlank())
                record.setTenantId(TenantBaseEntity.DEFAULT_TENANT_ID);
            record.stampCreated(operator, now);
        }
        if (record.getTime() == null) record.setTime(now);
        return recordRepository.save(record);
    }

    /**
     * 显式入参的发送通知入口 — 上游只需描述"发什么 + 给谁"，本方法负责：
     * <ol>
     *   <li>校验入参，非法直接抛 {@link IllegalArgumentException}；</li>
     *   <li>查询通知人档案并按 {@link com.vex.iot.domain.notify.model.NotifyUserEntity} 启用的渠道分发；</li>
     *   <li>落 {@link NotifyRecordEntity}（每条 user × 每条 channel）；</li>
     *   <li>真正调用 {@link com.vex.iot.domain.notify.channel.NotifyChannel#send}；</li>
     *   <li>回写发送状态（{@code SUCCESS / FAILED}）+ 错误信息。</li>
     * </ol>
     *
     * @param req 通知请求
     * @return 落库后的 {@link NotifyRecordEntity}（首条记录，方便调用方做幂等查）
     * @throws IllegalArgumentException 入参非法
     */
    public NotifyRecordEntity sendNotify(SendNotifyRequest req) {
        if (req == null || !req.isValid()) {
            throw new IllegalArgumentException("NotifyRequest 无效：userIds 与 content 均必填");
        }

        String tenantId = (req.tenantId() == null || req.tenantId().isBlank())
                ? TenantBaseEntity.DEFAULT_TENANT_ID : req.tenantId();

        List<NotifyUserEntity> users = userRepository.findByTenantIdAndIdIn(tenantId, req.userIds());
        if (users == null || users.isEmpty()) {
            log.warn("[NOTIFY-NO-USER] tenantId={} userIds={}", tenantId, req.userIds());
            throw new IllegalArgumentException("通知人不存在: " + req.userIds());
        }

        Instant now = req.time() == null ? Instant.now() : req.time();
        String operator = UserContext.username().orElse(TenantBaseEntity.SYSTEM_USER_ID);

        NotifyRecordEntity first = null;
        for (NotifyUserEntity user : users) {
            List<NotifyChannel> channels = pickChannels(user, req.channel());
            if (channels.isEmpty()) {
                log.warn("[NOTIFY-NO-CHANNEL] user={} requested={}", user.getId(), req.channel());
                continue;
            }

            for (NotifyChannel ch : channels) {
                NotifyRecordEntity record = buildRecord(req, user, ch.name(), req.event(), req.content(),
                        req.params(), now);
                record.stampCreated(operator, now);
                NotifyRecordEntity saved = recordRepository.save(record);

                boolean ok;
                String error;
                try {
                    ok = ch.send(user, req.content());
                    error = ok ? null : "channel=" + ch.name() + " 返回失败";
                } catch (Exception ex) {
                    log.error("[NOTIFY-ERROR] channel={} user={}", ch.name(), user.getId(), ex);
                    ok = false;
                    error = ex.getClass().getSimpleName() + ": " + ex.getMessage();
                }

                saved.setStatus(ok ? NotifyRecordStatus.SUCCESS : NotifyRecordStatus.FAILED);
                if (error != null) saved.setError(truncate(error, 512));
                NotifyRecordEntity updated = recordRepository.save(saved);

                if (first == null) first = updated;
            }
        }

        if (first == null) {
            throw new IllegalStateException("全部通知人无可用渠道: " + req.userIds());
        }
        return first;
    }

    /// 组装 NotifyRecordEntity — 时间 / 状态由发送循环回写
    private NotifyRecordEntity buildRecord(SendNotifyRequest req, NotifyUserEntity user,
                                           String channelName, String eventDesc, String content,
                                           String paramsJson, Instant now) {
        return NotifyRecordEntity.builder()
                .tenantId(user.getTenantId() == null ? req.tenantId() : user.getTenantId())
                .time(now)
                .event(truncate(eventDesc, 256))
                .notifyUserIds(List.of(user.getId()))
                .channel(NotifyChannelType.valueOf(channelName))
                .status(NotifyRecordStatus.PENDING)
                .content(truncate(content, 4000))
                .params(truncate(paramsJson, 4000))
                .error(null)
                .build();
    }

    /**
     * 解析用户启用的渠道列表 — 当 {@code request.channel} 指定时按指定渠道，否则按用户配置自动挑选。
     */
    private List<NotifyChannel> pickChannels(NotifyUserEntity user, NotifyChannelType requested) {
        List<NotifyChannel> list = new ArrayList<>();
        if (requested != null) {
            NotifyChannel picked = pickByType(user, requested);
            if (picked != null) list.add(picked);
            return list;
        }
        if (user.isSmsEnabled() && smsChannel.isPresent()) list.add(smsChannel.get());
        if (user.isWechatEnabled()) list.add(logChannel);
        return list;
    }

    private NotifyChannel pickByType(NotifyUserEntity user, NotifyChannelType type) {
        return switch (type) {
            case SMS -> smsChannel.filter(c -> c.isEnabled(user)).orElse(null);
            case WECHAT, EMAIL -> user.isWechatEnabled() ? logChannel : null;
        };
    }

    public List<NotifyRecordEntity> recordQuery(QueriesPageRequest req) {
        return JpaQueriesExecutor.of(NotifyRecordEntity.class, entityManager).page(req);
    }

    public long recordCount(QueriesPageRequest req) {
        return JpaQueriesExecutor.of(NotifyRecordEntity.class, entityManager).count(req != null ? req.getPredicate() : null);
    }

    public List<NotifyUserEntity> findByTenantIdAndIdIn(String tenantId, List<String> notifyUserIds) {
        return userRepository.findByTenantIdAndIdIn(tenantId, notifyUserIds);
    }
}
