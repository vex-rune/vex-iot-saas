package com.vex.iot.domain.notify;

import com.vex.iot.common.model.BaseEntity;
import com.vex.iot.common.queries.QueriesPageRequest;
import com.vex.iot.common.queries.jpa.JpaQueriesExecutor;
import com.vex.iot.common.util.IdGenerator;
import com.vex.iot.common.util.UserContext;
import com.vex.iot.domain.notify.exception.NotifyTemplateNotFoundException;
import com.vex.iot.domain.notify.model.NotifyTemplateEntity;
import com.vex.iot.domain.notify.repository.NotifyTemplateRepository;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;

@Service
@RequiredArgsConstructor
public class NotifyTemplateServer {
    private final NotifyTemplateRepository repository;

    @PersistenceContext
    private EntityManager entityManager;

    public NotifyTemplateEntity save(NotifyTemplateEntity template) {
        LocalDateTime now = LocalDateTime.now();
        String operator = UserContext.username().orElse(BaseEntity.SYSTEM_USER_ID);
        if (template.getId() == null || template.getId().isBlank()) {
            template.setId(IdGenerator.snowId());
            if (template.getTenantId() == null || template.getTenantId().isBlank()) {
                template.setTenantId(BaseEntity.DEFAULT_TENANT_ID);
            }
            template.stampCreated(operator, now);
        } else {
            template.stampUpdated(operator, now);
        }
        return repository.save(template);
    }

    public NotifyTemplateEntity get(String id) {
        return repository.findById(id)
                .orElseThrow(() -> new NotifyTemplateNotFoundException(id));
    }

    public void delete(String id) {
        NotifyTemplateEntity t = repository.findById(id).orElse(null);
        if (t != null) {
            String operator = UserContext.username().orElse(BaseEntity.SYSTEM_USER_ID);
            t.markDeleted(operator, LocalDateTime.now());
            repository.save(t);
        }
    }

    public List<NotifyTemplateEntity> query(QueriesPageRequest req) {
        return JpaQueriesExecutor.of(NotifyTemplateEntity.class, entityManager).page(req);
    }

    public long count(QueriesPageRequest req) {
        return JpaQueriesExecutor.of(NotifyTemplateEntity.class, entityManager).count(
                req != null ? req.getPredicate() : null);
    }
}
