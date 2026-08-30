package com.vex.iot.domain.notify;

import com.vex.iot.common.model.BaseEntity;
import com.vex.iot.common.queries.QueriesPageRequest;
import com.vex.iot.common.queries.jpa.JpaQueriesExecutor;
import com.vex.iot.common.util.IdGenerator;
import com.vex.iot.common.util.UserContext;
import com.vex.iot.domain.notify.model.NotifyRecordEntity;
import com.vex.iot.domain.notify.repository.NotifyRecordRepository;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;

@Service
@RequiredArgsConstructor
public class NotifyRecordServer {
    private final NotifyRecordRepository repository;

    @PersistenceContext
    private EntityManager entityManager;

    /**
     * 记录一次通知发送结果(由 NotifyDispatchServer 内部调用,不暴露 HTTP 接口)
     */
    public NotifyRecordEntity record(NotifyRecordEntity record) {
        LocalDateTime now = LocalDateTime.now();
        String operator = UserContext.username().orElse(BaseEntity.SYSTEM_USER_ID);
        if (record.getId() == null || record.getId().isBlank()) {
            record.setId(IdGenerator.snowId());
            if (record.getTenantId() == null || record.getTenantId().isBlank()) {
                record.setTenantId(BaseEntity.DEFAULT_TENANT_ID);
            }
            record.stampCreated(operator, now);
        }
        if (record.getTime() == null) {
            record.setTime(now);
        }
        return repository.save(record);
    }

    public List<NotifyRecordEntity> query(QueriesPageRequest req) {
        return JpaQueriesExecutor.of(NotifyRecordEntity.class, entityManager).page(req);
    }

    public long count(QueriesPageRequest req) {
        return JpaQueriesExecutor.of(NotifyRecordEntity.class, entityManager).count(
                req != null ? req.getPredicate() : null);
    }
}
