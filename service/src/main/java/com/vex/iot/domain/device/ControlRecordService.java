package com.vex.iot.domain.device;

import com.vex.iot.domain.device.enums.OperationResult;
import com.vex.iot.common.exception.NotFoundException;
import com.vex.iot.common.model.TenantBaseEntity;
import com.vex.iot.common.queries.QueriesPageRequest;
import com.vex.iot.common.queries.jpa.JpaQueriesExecutor;
import com.vex.iot.common.util.IdGenerator;
import com.vex.iot.common.util.UserContext;
import com.vex.iot.domain.device.model.ControlRecordEntity;
import com.vex.iot.domain.device.repository.ControlRecordRepository;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;

/**
 * 控制记录服务:记录每一次点位控制下发操作,提供查询/计数接口。
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ControlRecordService {

    private final ControlRecordRepository controlRecordRepository;

    @PersistenceContext
    private EntityManager entityManager;

    /**
     * 保存控制记录。
     *
     * @param record 控制记录
     * @return 保存后的记录
     */
    @Transactional
    public ControlRecordEntity save(ControlRecordEntity record) {
        Instant now = Instant.now();
        String operator = UserContext.username().orElse(TenantBaseEntity.SYSTEM_USER_ID);
        if (record.getId() == null || record.getId().isBlank()) {
            record.setId(IdGenerator.snowId());
            record.stampCreated(operator, now);
        } else {
            record.stampUpdated(operator, now);
        }
        if (record.getOccurredAt() == null) {
            record.setOccurredAt(now);
        }
        return controlRecordRepository.save(record);
    }

    /**
     * 分页查询控制记录（自动租户过滤）。
     */
    public List<ControlRecordEntity> query(QueriesPageRequest req) {
        req.withTenantFilter();
        return JpaQueriesExecutor.of(ControlRecordEntity.class, entityManager).page(req);
    }

    /**
     * 统计控制记录数量（自动租户过滤）。
     */
    public long count(QueriesPageRequest req) {
        req.withTenantFilter();
        return JpaQueriesExecutor.of(ControlRecordEntity.class, entityManager)
                .count(req.getPredicate());
    }

    /**
     * 按 ID 查询单条控制记录。
     */
    public ControlRecordEntity getById(String id) {
        return controlRecordRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("控制记录"));
    }

    /**
     * 删除控制记录（软删除）。
     */
    @Transactional
    public void delete(String id) {
        ControlRecordEntity exist = controlRecordRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("控制记录"));
        String operator = UserContext.username().orElse(TenantBaseEntity.SYSTEM_USER_ID);
        exist.markDeleted(operator, Instant.now());
        controlRecordRepository.save(exist);
    }

    /**
     * 查找指定设备+点位的 PENDING 控制记录。
     */
    public List<ControlRecordEntity> findPending(String deviceId, String pointCode) {
        return controlRecordRepository.findByDeviceIdAndPointCodeAndStatusOrderByOccurredAtAsc(
                deviceId, pointCode, OperationResult.PENDING);
    }

    /**
     * 完成一条 PENDING 控制记录：回填 writtenValue + writtenAt，标记为 SUCCESS。
     */
    @Transactional
    public void completePending(ControlRecordEntity record, String writtenValue) {
        record.setWrittenValue(writtenValue);
        record.setWrittenAt(Instant.now());
        record.setStatus(OperationResult.SUCCESS);
        String operator = UserContext.username().orElse(TenantBaseEntity.SYSTEM_USER_ID);
        record.stampUpdated(operator, Instant.now());
        controlRecordRepository.save(record);
        log.info("[控制回执] 完成 recordId={} deviceId={} pointCode={} writtenValue={}",
                record.getId(), record.getDeviceId(), record.getPointCode(), writtenValue);
    }
}