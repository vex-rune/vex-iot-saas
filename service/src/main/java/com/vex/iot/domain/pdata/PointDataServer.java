package com.vex.iot.domain.pdata;

import com.vex.iot.domain.alarm.PointAlarmEngine;
import com.vex.iot.common.enums.PointDataType;
import com.vex.iot.common.model.BaseEntity;
import com.vex.iot.common.model.CurrentUser;
import com.vex.iot.domain.device.model.DeviceEntity;
import com.vex.iot.domain.device.repository.DeviceRepository;
import com.vex.iot.domain.pdata.model.PointHistoryEntity;
import com.vex.iot.domain.pdata.model.PointRealtimeEntity;
import com.vex.iot.domain.pdata.parser.UsrG771Payload;
import com.vex.iot.domain.pdata.repository.PointHistoryRepository;
import com.vex.iot.domain.pdata.repository.PointRealtimeRepository;
import com.vex.iot.domain.device.model.PointDefinitionEntity;
import com.vex.iot.domain.device.repository.PointDefinitionRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.Map;

@Slf4j
@Service
@RequiredArgsConstructor
public class PointDataServer {
    private final DeviceRepository deviceRepository;
    private final PointDefinitionRepository pointDefinitionRepository;
    private final PointHistoryRepository historyRepository;
    private final PointRealtimeRepository realtimeRepository;
    private final PointAlarmEngine alarmEngine;
    private final ApplicationEventPublisher eventPublisher;

    private static String stampUserId(CurrentUser trigger) {
        return trigger == null ? BaseEntity.SYSTEM_USER_ID : trigger.username();
    }

    public boolean ingest(CurrentUser triggerUser, UsrG771Payload payload) {
        DeviceEntity d = deviceRepository.findByDeviceCode(payload.getDeviceCode()).orElse(null);
        if (d == null) {
            log.warn("收到未注册设备的上报 deviceCode={},丢弃", payload.getDeviceCode());
            return false;
        }
        if (!d.isEnabled()) {
            log.debug("设备已禁用,跳过 deviceCode={}", d.getDeviceCode());
            return false;
        }

        Instant ts = payload.getDeviceTimestamp() != null ? payload.getDeviceTimestamp() : Instant.now();
        Instant ingestedAt = Instant.now();
        LocalDateTime now = LocalDateTime.ofInstant(ingestedAt, ZoneId.systemDefault());

        // 查询该设备所有点位定义，构建pointCode -> definition映射
        Map<String, PointDefinitionEntity> defMap = pointDefinitionRepository.findByDeviceId(d.getId()).stream()
                .collect(java.util.stream.Collectors.toMap(PointDefinitionEntity::getPointCode, pd -> pd, (a, b) -> a));

        // 遍历上报的每个点位，逐条写入历史 + 更新实时快照 + 告警评估
        for (Map.Entry<String, String> entry : payload.getValues().entrySet()) {
            String pointCode = entry.getKey();
            String rawValue = entry.getValue();

            // 1. 写入历史记录
            PointDefinitionEntity def = defMap.get(pointCode);
            PointHistoryEntity history = buildHistory(d, pointCode, rawValue, ts, ingestedAt, def);
            historyRepository.save(history);

            // 2. 更新或创建实时快照（per-point）
            PointRealtimeEntity realtime = realtimeRepository.findByDeviceIdAndPointCode(d.getId(), pointCode)
                    .orElseGet(() -> PointRealtimeEntity.builder()
                            .deviceId(d.getId())
                            .deviceCode(d.getDeviceCode())
                            .pointCode(pointCode)
                            .build());
            realtime.setValue(rawValue);
            realtime.setRawValue(rawValue);
            realtime.setTimestamp(ts);
            realtime.setUpdatedAtTs(ingestedAt);
            realtime.setTenantId(d.getTenantId());
            realtime.stampUpdated(stampUserId(triggerUser), now);
            if (realtime.getCreatedAt() == null) {
                realtime.stampCreated(stampUserId(triggerUser), now);
            }

            // 3. 告警评估
            if (def != null) {
                alarmEngine.evaluate(def, rawValue, realtime);
                alarmEngine.checkDataExpire(def, realtime);
            }

            realtimeRepository.save(realtime);
        }

        // 发布事件通知
        eventPublisher.publishEvent(com.vex.iot.domain.pdata.event.PointValueSnapshot.builder()
                .triggerUser(triggerUser).tenantId(d.getTenantId()).deviceId(d.getId())
                .deviceCode(d.getDeviceCode()).timestamp(ts).values(payload.getValues()).build());

        return true;
    }

    /// 构建历史记录，根据dataType填充对应类型字段
    private PointHistoryEntity buildHistory(DeviceEntity device, String pointCode, String rawValue,
                                            Instant ts, Instant ingestedAt, PointDefinitionEntity def) {
        PointHistoryEntity history = PointHistoryEntity.builder()
                .deviceId(device.getId())
                .deviceCode(device.getDeviceCode())
                .pointCode(pointCode)
                .timestamp(ts)
                .ingestedAt(ingestedAt)
                .value(rawValue) // 永远赋值原始字符串
                .build();

        // 根据点位定义的dataType决定填充哪个类型字段
        // 注意：此处使用Modbus DataType映射到PointDataType
        if (def != null && def.getDataType() != null) {
            PointDataType pdt = mapToSnapshotDataType(def.getDataType());
            history.setDataType(pdt);
            fillTypedValue(history, pdt, rawValue);
        }

        return history;
    }

    /// 将抽象 DataType 映射到 PointHistory 快照的 PointDataType
    private PointDataType mapToSnapshotDataType(com.vex.iot.common.enums.DataType modbusType) {
        return switch (modbusType) {
            case BOOL -> PointDataType.BOOL;
            case LONG -> PointDataType.INT;
            case STRING -> PointDataType.STRING;
            case DOUBLE -> PointDataType.DOUBLE;
        };
    }

    /// 根据PointDataType填充对应的值字段，另外两个置null
    private void fillTypedValue(PointHistoryEntity history, PointDataType pdt, String rawValue) {
        if (rawValue == null || rawValue.isBlank()) return;
        try {
            switch (pdt) {
                case BOOL -> {
                    history.setIntValue(
                            "1".equals(rawValue.trim()) || "true".equalsIgnoreCase(rawValue.trim()) ? 1L : 0L);
                    history.setDoubleValue(null);
                    history.setStringValue(null);
                }
                case INT -> {
                    history.setIntValue(Long.parseLong(rawValue.trim()));
                    history.setDoubleValue(null);
                    history.setStringValue(null);
                }
                case FLOAT, DOUBLE -> {
                    history.setDoubleValue(Double.parseDouble(rawValue.trim()));
                    history.setIntValue(null);
                    history.setStringValue(null);
                }
                case STRING -> {
                    history.setStringValue(rawValue);
                    history.setIntValue(null);
                    history.setDoubleValue(null);
                }
            }
        } catch (NumberFormatException e) {
            log.warn("点位值类型转换失败: value={}, dataType={}", rawValue, pdt);
        }
    }
}
