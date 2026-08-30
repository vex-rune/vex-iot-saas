package com.vex.iot.domain.notify;

import com.vex.iot.common.model.BaseEntity;
import com.vex.iot.common.util.IdGenerator;
import com.vex.iot.common.util.UserContext;
import com.vex.iot.domain.notify.model.NotifyUserEntity;
import com.vex.iot.domain.notify.repository.NotifyUserRepository;
import com.vex.iot.common.queries.QueriesPageRequest;
import com.vex.iot.common.queries.jpa.JpaQueriesExecutor;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class NotifyServer {
    private final NotifyUserRepository repository;

    @PersistenceContext
    private EntityManager entityManager;

    public NotifyUserEntity save(NotifyUserEntity user) {
        LocalDateTime now = LocalDateTime.now();
        String operator = UserContext.username().orElse(BaseEntity.SYSTEM_USER_ID);
        if (user.getId() == null || user.getId().isBlank()) {
            user.setId(IdGenerator.snowId());
            if (user.getTenantId() == null || user.getTenantId().isBlank()) {
                user.setTenantId(BaseEntity.DEFAULT_TENANT_ID);
            }
            user.stampCreated(operator, now);
        } else {
            user.stampUpdated(operator, now);
        }
        return repository.save(user);
    }

    public void delete(String id) {
        NotifyUserEntity u = repository.findById(id).orElse(null);
        if (u != null) {
            String operator = UserContext.username().orElse(BaseEntity.SYSTEM_USER_ID);
            u.markDeleted(operator, LocalDateTime.now());
            repository.save(u);
        }
    }

    public List<NotifyUserEntity> query(QueriesPageRequest req) {
        return JpaQueriesExecutor.of(NotifyUserEntity.class, entityManager).page(req);
    }

    public long count(QueriesPageRequest req) {
        return JpaQueriesExecutor.of(NotifyUserEntity.class, entityManager).count(
                req != null ? req.getPredicate() : null);
    }

    public void send(String userId, String message) {
        log.warn("[NOTIFY-STUB] userId={} msg={}", userId, message);
    }
}