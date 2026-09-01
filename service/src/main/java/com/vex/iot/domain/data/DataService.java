package com.vex.iot.domain.data;

import com.vex.iot.common.queries.QueriesPageRequest;
import com.vex.iot.common.queries.jpa.JpaQueriesExecutor;
import com.vex.iot.domain.data.event.DataUpdateEvent;
import com.vex.iot.domain.data.model.DataEntity;
import com.vex.iot.domain.data.repository.DataRepository;
import jakarta.persistence.EntityManager;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;

import java.util.List;

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


    public DataEntity save(@Valid DataEntity device) {
        DataEntity save = historyRepository.save(device);

        // 发送spring event
        eventPublisher.publishEvent(new DataUpdateEvent(save));

        return save;
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
