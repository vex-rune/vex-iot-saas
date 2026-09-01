package com.vex.iot.app;

import com.vex.iot.app.mqtt.usr.DeviceUpReport;
import com.vex.iot.app.mqtt.usr.MqttUsrHeartMessage;
import com.vex.iot.app.mqtt.usr.MqttUsrUpdateMessage;
import com.vex.iot.app.mqtt.usr.MqttUsrWillMessage;
import com.vex.iot.common.enums.DataType;
import com.vex.iot.common.enums.DeviceOnline;
import com.vex.iot.common.enums.PointDataType;
import com.vex.iot.domain.data.DataService;
import com.vex.iot.domain.data.model.DataEntity;
import com.vex.iot.domain.data.repository.DataRepository;
import com.vex.iot.domain.device.DeviceService;
import com.vex.iot.domain.device.event.DeviceHeartbeatEvent;
import com.vex.iot.domain.device.event.DeviceOfflineEvent;
import com.vex.iot.domain.device.model.DeviceEntity;
import com.vex.iot.domain.device.model.PointEntity;
import com.vex.iot.domain.device.repository.DeviceRepository;
import com.vex.iot.domain.device.repository.PointDefinitionRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.apache.logging.log4j.util.Strings;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.format.DateTimeParseException;
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
public class DeviceDataApp {

    private static final int MAX_HISTORY_POINTS = 5000;

    private final ApplicationEventPublisher eventPublisher;
    private final DataService dataService;
    private final DeviceService deviceService;

    /**
     * 处理设备心跳:将设备标记为在线并刷新最后心跳时间。
     */
    public void heart(MqttUsrHeartMessage event) {
        String gatewayId = event.payload().trim();
        if (Strings.isBlank(gatewayId)) {
            log.warn("心跳消息 payload 为空，忽略");
            return;
        }
        deviceService.heart(gatewayId);
    }

    /**
     * 处理设备数据上报:逐条匹配点位定义并持久化历史快照。
     */
    public void update(MqttUsrUpdateMessage event) {
        DeviceUpReport.DeviceUpParams params = event.payload().payload().params();
        if (params == null || params.gatewayId() == null || params.gatewayId().isBlank()) {
            log.warn("数据上报消息缺少设备标识，忽略");
            return;
        }

        String gatewayId = params.gatewayId();
        Optional<DeviceEntity> deviceOpt = deviceService.optDevice(gatewayId);
        if (deviceOpt.isEmpty()) {
            log.warn("数据上报消息对应的设备不存在: {}", gatewayId);
            return;
        }

        DeviceEntity device = deviceOpt.get();
        List<DeviceUpReport.ReadDataItem> rData = params.data();
        if (rData == null || rData.isEmpty()) {
            return;
        }

        // 按 pointCode 索引该设备下所有点位定义
        List<PointEntity> points = deviceService.queryPointsByDeviceId(device.getId());

        LocalDateTime deviceTime = parseDeviceTime(params.sysLocalTime());
        LocalDateTime now = LocalDateTime.now();

        for (DeviceUpReport.ReadDataItem item : rData) {
            if (item.name() == null || item.name().isBlank()) {
                continue;
            }
            if (item.err() != null && !item.err().isBlank() && DeviceUpReport.OK.equals(item.err())) {
                log.debug("点位数据错误: gatewayId={}, pointCode={}, err={}", gatewayId, item.name(), item.err());
                continue;
            }
            if (Strings.isNotBlank(item.value())) {
                log.debug("点位数据为空: gatewayId={}, pointCode={}", gatewayId, item.name());
                continue;
            }

            Optional<PointEntity> pointDefOpt = points.stream().filter(p -> p.getPointCode().equals(item.name())).findFirst();
            if (pointDefOpt.isEmpty()) {
                log.debug("未找到点位定义: gatewayId={}, pointCode={}", gatewayId, item.name());
                continue;
            }

            PointEntity point = pointDefOpt.get();

            DataEntity data = DataEntity.builder()
                    .deviceId(device.getId())
                    .deviceName(device.getDeviceName())
                    .pointId(point.getId())
                    .dataType(mapDataType(point.getDataType()))
                    .timestamp(deviceTime)
                    .ingestedAt(now)
                    .value(item.value())
                    .build();

            fillTypedValue(data, point.getDataType(), item.value());

            dataService.save(data);
        }
    }

    /**
     * 处理设备离线(Will 消息):将设备标记为离线。
     */
    public void will(MqttUsrWillMessage event) {
        String gatewayId = event.gatewayId().trim();
        if (gatewayId.isEmpty()) {
            log.warn("离线消息 payload 为空，忽略");
            return;
        }
        deviceService.will(gatewayId);
    }

    // ==================== 内部工具 ====================

    /**
     * 解析设备上报时间。优先尝试 epoch 毫秒,其次 ISO 本地时间,均失败则返回当前时间。
     */
    private static LocalDateTime parseDeviceTime(String sysLocalTime) {
        if (sysLocalTime == null || sysLocalTime.isBlank()) {
            return LocalDateTime.now();
        }
        try {
            long millis = Long.parseLong(sysLocalTime.trim());
            return Instant.ofEpochMilli(millis).atZone(ZoneId.systemDefault()).toLocalDateTime();
        } catch (NumberFormatException ignored) {
            // 非 epoch 格式,继续尝试 ISO 解析
        }
        try {
            return LocalDateTime.parse(sysLocalTime.trim());
        } catch (DateTimeParseException ignored) {
            // 无法解析,使用当前时间
        }
        return LocalDateTime.now();
    }

    private static PointDataType mapDataType(DataType dataType) {
        if (dataType == null) {
            return PointDataType.STRING;
        }
        return switch (dataType) {
            case BOOL -> PointDataType.BOOL;
            case LONG -> PointDataType.INT;
            case DOUBLE -> PointDataType.DOUBLE;
            case STRING -> PointDataType.STRING;
        };
    }

    private static void fillTypedValue(DataEntity data, DataType dataType, String value) {
        if (dataType == null) {
            return;
        }
        switch (dataType) {
            case BOOL -> data.setIntValue("1".equals(value) || "true".equalsIgnoreCase(value) ? 1L : 0L);
            case LONG -> {
                try {
                    data.setIntValue(Long.parseLong(value.trim()));
                } catch (NumberFormatException ignored) {
                    // 值无法解析为 Long,保留字符串快照
                }
            }
            case DOUBLE -> {
                try {
                    data.setDoubleValue(Double.parseDouble(value.trim()));
                } catch (NumberFormatException ignored) {
                    // 值无法解析为 Double,保留字符串快照
                }
            }
            case STRING -> data.setStringValue(value);
        }

        data.setStringValue(value);
    }
}
