package com.vex.iot.app;

import com.vex.iot.app.mqtt.usr.DeviceUpReport;
import com.vex.iot.app.mqtt.usr.MqttUsrUpdateMessage;
import com.vex.iot.app.mqtt.usr.MqttUsrWillMessage;
import com.vex.iot.common.enums.DataType;
import com.vex.iot.common.enums.PointDataType;
import com.vex.iot.domain.data.DataService;
import com.vex.iot.domain.data.model.DataEntity;
import com.vex.iot.domain.data.model.PointDataState;
import com.vex.iot.domain.device.DeviceService;
import com.vex.iot.domain.device.model.DeviceEntity;
import com.vex.iot.domain.device.model.PointEntity;
import jakarta.validation.constraints.NotNull;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.apache.logging.log4j.util.Strings;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;

import java.time.Instant;
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

    private static ValueResult analysisValue(DeviceEntity device, DeviceUpReport.ReadDataItem item) {
        if (item.name() == null || item.name().isBlank()) {
            return new ValueResult(PointDataState.ERROR, null);
        }
        if (item.err() != null && !item.err().isBlank() && DeviceUpReport.OK.equals(item.err())) {
            log.debug("点位数据错误: device={}, pointCode={}, err={}", device, item.name(), item.err());
            return new ValueResult(PointDataState.ERROR, null);
        }
        if (Strings.isBlank(item.value())) {
            log.debug("点位数据为空: device={}, pointCode={}", device, item.name());
            return new ValueResult(PointDataState.ERROR, null);
        }
        return new ValueResult(PointDataState.NORMAL, item.value());
    }

    /**
     * 解析设备上报时间。优先尝试 epoch 毫秒,其次 ISO 本地时间,均失败则返回当前时间。
     */
    private static Instant parseDeviceTime(String sysLocalTime) {
        if (sysLocalTime == null || sysLocalTime.isBlank()) {
            return Instant.now();
        }
        try {
            long millis = Long.parseLong(sysLocalTime.trim());
            return Instant.ofEpochMilli(millis);
        } catch (NumberFormatException ignored) {
            // 非 epoch 格式,继续尝试 ISO 解析
        }
        try {
            return Instant.parse(sysLocalTime.trim());
        } catch (DateTimeParseException ignored) {
            // 无法解析,使用当前时间
        }
        return Instant.now();
    }

    private static PointDataType mapDataType(DataType dataType) {
        if (dataType == null) {
            return PointDataType.STRING;
        }
        return switch (dataType) {
            case BOOL -> PointDataType.BOOL;
            case INT -> PointDataType.INT;
            case DOUBLE -> PointDataType.DOUBLE;
            case STRING -> PointDataType.STRING;
        };
    }

    private static void setFillTypedValue(@NotNull DataEntity.DataEntityBuilder<?, ?> data, @NotNull DataType dataType, String value) {

        if (Strings.isBlank(value)) {
            data.stringValue(value);
            return;
        }


        switch (dataType) {
            case INT -> {
                try {
                    data.intValue(Long.parseLong(value.trim()));
                } catch (NumberFormatException ignored) {
                    // 值无法解析为 Long,保留字符串快照
                    data.stringValue(value);
                }
            }
            case DOUBLE -> {
                try {
                    data.doubleValue(Double.parseDouble(value.trim()));
                } catch (NumberFormatException ignored) {
                    // 值无法解析为 Double,保留字符串快照
                }
            }
        }
        data.stringValue(value);
    }

    /**
     * 处理设备心跳:将设备标记为在线并刷新最后心跳时间。
     */
    public void heartByGatewayId(String gatewayId) {
        if (Strings.isBlank(gatewayId)) {
            log.warn("心跳消息 payload 为空，忽略");
            return;
        }
        deviceService.heartByGatewayId(gatewayId);
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
        List<DeviceEntity> devices = deviceService.optDeviceByGatewayId(gatewayId);
        if (devices.isEmpty()) {
            log.warn("数据上报消息对应的设备不存在: {}", gatewayId);
            return;
        }

        for (DeviceEntity device : devices) {
            updateData(params, device);
            updateDevice(device);
        }
    }

    // ==================== 内部工具 ====================

    private void updateDevice(DeviceEntity device) {
        deviceService.heartByGatewayId(device.getGatewayId());
    }

    private void updateData(DeviceUpReport.DeviceUpParams params, DeviceEntity device) {
        List<DeviceUpReport.ReadDataItem> rData = params.data();
        if (rData == null || rData.isEmpty()) {
            return;
        }

        // 按 pointCode 索引该设备下所有点位定义
        List<PointEntity> points = deviceService.queryPointsByDeviceId(device.getId());

        Instant deviceTime = parseDeviceTime(params.sysLocalTime());
        Instant now = Instant.now();

        for (DeviceUpReport.ReadDataItem item : rData) {
            ValueResult valueResult = analysisValue(device, item);

            Optional<PointEntity> pointDefOpt = points.stream().filter(p -> p.getPointCode().equals(item.name())).findFirst();
            if (pointDefOpt.isEmpty()) {
                log.debug("未找到点位定义: device={}, pointCode={}", device, item.name());
                continue;
            }
            PointEntity point = pointDefOpt.get();


            DataEntity.DataEntityBuilder<?, ?> builder = DataEntity.builder()
                    .deviceId(device.getId())
                    .deviceName(device.getDeviceName())
                    .pointCode(point.getPointCode())
                    .pointId(point.getPointCode())  // 兼容：pointId 也填 pointCode
                    .pointName(point.getPointName())
                    .unit(point.getUnit())
                    .dataType(mapDataType(point.getDataType()))
                    .timestamp(deviceTime)
                    .ingestedAt(now)
                    .dataState(valueResult.state());

            setFillTypedValue(builder, point.getDataType(), item.value());

            DataEntity data = builder.build();

            // todo 测试数据 — 基于正弦波 + 小随机扰动
            // 用 pointCode 的 hashCode 作为相位偏移,让不同点位曲线不同步
            double t = now.getEpochSecond() / 60.0;
            double phase = (point.getPointCode().hashCode() & 0xFFFF) / 65536.0 * 2 * Math.PI;
            double base = 50 + 30 * Math.sin(t * 2 * Math.PI / 60 + phase);
            double noise = (Math.random() - 0.5) * 6;
            double doubleValue = Math.max(0, Math.min(100, base + noise));
            data.setDataState(PointDataState.NORMAL);
            data.setDoubleValue(doubleValue);
            data.setStringValue(String.valueOf(doubleValue));

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
        deviceService.willByGatewayId(gatewayId);
    }

    private record ValueResult(
            PointDataState state,
            String value
    ) {
    }
}
