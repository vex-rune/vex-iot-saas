package com.vex.iot.domain.data;

import com.vex.iot.common.queries.QueriesPageRequest;
import com.vex.iot.common.queries.jpa.JpaQueriesExecutor;
import com.vex.iot.domain.data.event.DataUpdateEvent;
import com.vex.iot.domain.data.model.DataEntity;
import com.vex.iot.domain.data.model.RealtimeDataEntity;
import com.vex.iot.domain.data.repository.DataRepository;
import com.vex.iot.domain.data.repository.PointDataLatestRepository;
import jakarta.persistence.EntityManager;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

/**
 * pdata 的最简 CRUD 入口 — 持久化点位实时快照 / 历史数据 / 设备心跳 / 离线状态。
 *
 * <p>采集器发布的 Spring Event 在此落地;告警 / SSE 推送另开订阅方,本类职责纯粹。
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class DataService {

    private final ApplicationEventPublisher eventPublisher;
    private final EntityManager entityManager;
    private final DataRepository historyRepository;
    private final PointDataLatestRepository pointDataLatestRepository;


    @Transactional
    public DataEntity save(@Valid DataEntity device) {
        DataEntity save = historyRepository.save(device);

        // 更新点位最新数据
        updatePointDataLatest(save);

        // 发送spring event
        eventPublisher.publishEvent(new DataUpdateEvent(save));

        return save;
    }

    /**
     * 更新点位最新数据表（point_data_latest）。
     * 每个点位（deviceId + pointId）仅保留一条最新记录。
     */
    private void updatePointDataLatest(DataEntity data) {
        Optional<RealtimeDataEntity> existingOpt =
                pointDataLatestRepository.findByDeviceIdAndPointId(data.getDeviceId(), data.getPointId());

        RealtimeDataEntity latest;
        if (existingOpt.isPresent()) {
            // 更新现有记录
            latest = existingOpt.get();
            latest.setPointName(data.getPointName());
            latest.setUnit(data.getUnit());
            latest.setDataType(data.getDataType());
            latest.setIntValue(data.getIntValue());
            latest.setDoubleValue(data.getDoubleValue());
            latest.setStringValue(data.getStringValue());
            latest.setTimestamp(data.getTimestamp());
            latest.setIngestedAt(data.getIngestedAt());
            latest.setDataState(data.getDataState());
            latest.stampUpdated(RealtimeDataEntity.SYSTEM_USER_ID, Instant.now());
        } else {
            // 创建新记录
            latest = RealtimeDataEntity.builder()
                    .deviceId(data.getDeviceId())
                    .pointId(data.getPointId())
                    .pointName(data.getPointName())
                    .unit(data.getUnit())
                    .dataType(data.getDataType())
                    .intValue(data.getIntValue())
                    .doubleValue(data.getDoubleValue())
                    .stringValue(data.getStringValue())
                    .timestamp(data.getTimestamp())
                    .ingestedAt(data.getIngestedAt())
                    .dataState(data.getDataState())
                    .build();
            latest.stampCreated(RealtimeDataEntity.SYSTEM_USER_ID, Instant.now());
        }
        pointDataLatestRepository.save(latest);
    }

    public DataEntity getLatestData(String pointId) {
        return historyRepository.findFirstByPointIdOrderByTimestampDesc(pointId);
    }

    public Long count(@Valid QueriesPageRequest req) {
        return JpaQueriesExecutor.of(DataEntity.class, entityManager).count(req.getPredicate());
    }

    public List<DataEntity> query(@Valid QueriesPageRequest req) {
        return JpaQueriesExecutor.of(DataEntity.class, entityManager).page(req);
    }
}
