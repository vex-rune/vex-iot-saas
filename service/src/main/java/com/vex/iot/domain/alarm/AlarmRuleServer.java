package com.vex.iot.domain.alarm;

import com.vex.iot.domain.alarm.exception.AlarmRuleNotFoundException;
import com.vex.iot.domain.alarm.model.AlarmRuleEntity;
import com.vex.iot.domain.alarm.repository.AlarmRuleRepository;
import com.vex.iot.common.model.BaseEntity;
import com.vex.iot.common.util.IdGenerator;
import com.vex.iot.common.util.UserContext;
import com.vex.iot.common.queries.QueriesPageRequest;
import com.vex.iot.common.queries.jpa.JpaQueriesExecutor;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;

@Service
@RequiredArgsConstructor
public class AlarmRuleServer {
    private final AlarmRuleRepository repository;

    @PersistenceContext
    private EntityManager entityManager;

    public AlarmRuleEntity save(AlarmRuleEntity rule) {
        LocalDateTime now = LocalDateTime.now();
        String operator = UserContext.username().orElse(BaseEntity.SYSTEM_USER_ID);
        if (rule.getId() == null || rule.getId().isBlank()) {
            rule.setId(IdGenerator.snowId());
            if (rule.getTenantId() == null || rule.getTenantId().isBlank()) {
                rule.setTenantId(BaseEntity.DEFAULT_TENANT_ID);
            }
            rule.stampCreated(operator, now);
        } else {
            rule.stampUpdated(operator, now);
        }
        return repository.save(rule);
    }

    public AlarmRuleEntity get(String id) {
        return repository.findById(id).orElseThrow(() -> new AlarmRuleNotFoundException(id));
    }

    public void delete(String id) {
        repository.deleteById(id);
    }

    public List<AlarmRuleEntity> query(QueriesPageRequest req) {
        return JpaQueriesExecutor.of(AlarmRuleEntity.class, entityManager).page(req);
    }

    public long count(QueriesPageRequest req) {
        return JpaQueriesExecutor.of(AlarmRuleEntity.class, entityManager).count(
                req != null ? req.getPredicate() : null);
    }

    public List<AlarmRuleEntity> listByDevice(String deviceId) {
        return repository.findByDeviceIdAndEnabledTrue(deviceId);
    }
}