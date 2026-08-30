package com.vex.iot.domain.alarm;

import com.vex.iot.domain.alarm.model.AlarmEventEntity;
import com.vex.iot.domain.alarm.repository.AlarmEventRepository;
import com.vex.iot.common.enums.AlarmAckStatus;
import com.vex.iot.common.enums.AlarmLevel;
import com.vex.iot.common.exception.BusinessExceptions.NotFoundException;
import com.vex.iot.common.util.IdGenerator;
import com.vex.iot.common.util.UserContext;
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
public class AlarmEventServer {
    private final AlarmEventRepository repository;

    @PersistenceContext
    private EntityManager entityManager;

    public void record(String deviceId, String pointCode, String ruleId, AlarmLevel level, String message) {
        AlarmEventEntity event = AlarmEventEntity.builder()
                .id(IdGenerator.snowId())
                .deviceId(deviceId).pointCode(pointCode).ruleId(ruleId)
                .level(level).message(message).acknowledged(AlarmAckStatus.UNACK)
                .triggeredAt(LocalDateTime.now()).build();
        repository.save(event);
        log.warn("报警事件 device={} point={} level={} msg={}", deviceId, pointCode, level, message);
    }

    public List<AlarmEventEntity> query(QueriesPageRequest req) {
        return JpaQueriesExecutor.of(AlarmEventEntity.class, entityManager).page(req);
    }

    public long count(QueriesPageRequest req) {
        return JpaQueriesExecutor.of(AlarmEventEntity.class, entityManager).count(
                req != null ? req.getPredicate() : null);
    }

    /**
     * 确认告警事件
     *
     * @param id 告警事件ID
     * @return 确认后的告警事件
     */
    public AlarmEventEntity acknowledge(String id) {
        AlarmEventEntity e = repository.findById(id)
                .orElseThrow(() -> new NotFoundException("报警事件"));
        e.setAcknowledged(AlarmAckStatus.ACK);
        e.setAcknowledgedAt(LocalDateTime.now());
        e.setAcknowledgedBy(UserContext.username().orElse(null));
        return repository.save(e);
    }
}