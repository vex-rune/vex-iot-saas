package com.vex.iot.domain.device;

import com.vex.iot.common.queries.QueriesPageRequest;
import com.vex.iot.common.queries.jpa.JpaQueriesExecutor;
import com.vex.iot.domain.device.enums.DataType;
import com.vex.iot.domain.device.event.DataUpdateEvent;
import com.vex.iot.domain.device.model.DataEntity;
import com.vex.iot.domain.device.model.RealtimeDataEntity;
import com.vex.iot.domain.device.repository.DataRepository;
import com.vex.iot.domain.device.repository.PointDataLatestRepository;
import jakarta.persistence.EntityManager;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.data.domain.Limit;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.Objects;
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
     * 批量保存历史数据（不触发事件，用于数据播种）
     */
    @Transactional
    public void saveAllBatch(List<DataEntity> dataList) {
        historyRepository.saveAll(dataList);
    }

    /**
     * 更新点位最新数据表（point_data_latest）。
     * 每个点位（deviceId + pointId）仅保留一条最新记录。
     * 数值对比：值相同则跳过更新，减少无效写入。
     */
    private void updatePointDataLatest(DataEntity data) {
        Optional<RealtimeDataEntity> existingOpt =
                pointDataLatestRepository.findByDeviceIdAndPointId(data.getDeviceId(), data.getPointId());

        RealtimeDataEntity latest;
        if (existingOpt.isPresent()) {
            latest = existingOpt.get();
            // 数值对比：值相同则跳过更新
            if (isSameValue(latest, data)) {
                return;
            }
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

    /**
     * 判断最新值与新值是否相同（按数据类型分别比较）。
     * 值相同 + 状态相同 → true（跳过更新）
     */
    private boolean isSameValue(RealtimeDataEntity existing, DataEntity incoming) {
        // 状态不同（如 NORMAL → ERROR）始终更新
        if (existing.getDataState() != incoming.getDataState()) {
            return false;
        }
        // 按数据类型比较值
        DataType type = incoming.getDataType();
        if (type == null) type = existing.getDataType();
        if (type == null) return Objects.equals(existing.getStringValue(), incoming.getStringValue());

        return switch (type) {
            case BOOL, INT -> Objects.equals(existing.getIntValue(), incoming.getIntValue());
            case FLOAT, DOUBLE -> Objects.equals(existing.getDoubleValue(), incoming.getDoubleValue());
            case STRING -> Objects.equals(existing.getStringValue(), incoming.getStringValue());
        };
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

    public List<DataEntity> query(String tenantId, String deviceName, String pointName, Instant startTime, Instant endTime, Integer limit) {
        return historyRepository.queryByTenantIdAndDeviceNameLikeAndPointNameLikeAndTimestampBetweenOrderByTimestampDesc(
                tenantId, deviceName, pointName, startTime, endTime, Limit.of(limit)
        );
    }



















}
