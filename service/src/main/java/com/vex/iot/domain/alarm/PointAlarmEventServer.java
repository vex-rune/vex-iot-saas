package com.vex.iot.domain.alarm;

import com.vex.iot.domain.alarm.exception.PointAlarmEventNotFoundException;
import com.vex.iot.domain.alarm.model.PointAlarmEventEntity;
import com.vex.iot.domain.alarm.repository.PointAlarmEventRepository;
import com.vex.iot.common.enums.EventStatus;
import com.vex.iot.common.model.BaseEntity;
import com.vex.iot.common.queries.QueriesPageRequest;
import com.vex.iot.common.queries.jpa.JpaQueriesExecutor;
import com.vex.iot.common.util.UserContext;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.time.LocalDateTime;
import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class PointAlarmEventServer {

    private final PointAlarmEventRepository repository;

    @PersistenceContext
    private EntityManager entityManager;

    public PointAlarmEventEntity get(String id) {
        return repository.findById(id).orElseThrow(() -> new PointAlarmEventNotFoundException(id));
    }

    /// 标准条件分页查询(供 query/count 端点)
    public List<PointAlarmEventEntity> query(QueriesPageRequest req) {
        return JpaQueriesExecutor.of(PointAlarmEventEntity.class, entityManager).page(req);
    }

    /// 标准条件数量查询
    public long count(QueriesPageRequest req) {
        return JpaQueriesExecutor.of(PointAlarmEventEntity.class, entityManager).count(
                req != null ? req.getPredicate() : null);
    }

    /// 查询某点位当前活跃（ACTIVE）的告警事件
    public List<PointAlarmEventEntity> listActiveByPointDefinition(String pointDefinitionId) {
        return repository.findByPointDefinitionIdAndEventStatusIn(
                pointDefinitionId, List.of(EventStatus.ACTIVE));
    }

    /// 查询某规则当前活跃告警事件
    public PointAlarmEventEntity findActiveByRule(String alarmRuleId) {
        return repository.findByAlarmRuleIdAndEventStatus(alarmRuleId, EventStatus.ACTIVE).orElse(null);
    }

    /// 查询全部活跃告警事件（分页）
    public List<PointAlarmEventEntity> listActiveEvents(int page, int size) {
        return repository.findByEventStatus(EventStatus.ACTIVE, PageRequest.of(page, size));
    }

    /// 活跃告警总数
    public long countActive() {
        return repository.countByEventStatus(EventStatus.ACTIVE);
    }

    /// 创建新的告警事件
    public PointAlarmEventEntity createActive(PointAlarmEventEntity event) {
        LocalDateTime now = LocalDateTime.now();
        String operator = BaseEntity.SYSTEM_USER_ID;
        event.setEventStatus(EventStatus.ACTIVE);
        event.setOccurTime(Instant.now());
        event.stampCreated(operator, now);
        return repository.save(event);
    }

    /// 告警恢复
    public void recover(PointAlarmEventEntity event) {
        LocalDateTime now = LocalDateTime.now();
        String operator = BaseEntity.SYSTEM_USER_ID;
        event.setEventStatus(EventStatus.RECOVERED);
        event.setRecoverTime(Instant.now());
        event.stampUpdated(operator, now);
        repository.save(event);
    }

    /// 人工确认告警
    /// ACTIVE事件：仅记录确认人和时间，eventStatus保持ACTIVE（spec 4.6）
    /// RECOVERED事件：转为ACK状态
    public PointAlarmEventEntity acknowledge(String eventId) {
        PointAlarmEventEntity event = get(eventId);
        LocalDateTime now = LocalDateTime.now();
        String operator = UserContext.username().orElse(BaseEntity.SYSTEM_USER_ID);
        event.setAckTime(Instant.now());
        event.setAckUserId(operator);
        if (event.getEventStatus() != EventStatus.ACTIVE) {
            event.setEventStatus(EventStatus.ACK);
        }
        event.stampUpdated(operator, now);
        return repository.save(event);
    }
}
