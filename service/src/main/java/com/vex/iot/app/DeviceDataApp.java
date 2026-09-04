package com.vex.iot.app;

import com.vex.iot.app.mqtt.usr.DeviceUpReport;
import com.vex.iot.app.mqtt.usr.MqttUsrUpdateMessage;
import com.vex.iot.app.mqtt.usr.MqttUsrWillMessage;
import com.vex.iot.common.enums.DataType;
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
import org.springframework.stereotype.Service;

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
public class DeviceDataApp {

    private final DataService dataService;
    private final DeviceService deviceService;

    private static ValueResult analysisValue(DeviceUpReport.ReadDataItem item) {
        if (item.name() == null || item.name().isBlank()) {
            return new ValueResult(PointDataState.ERROR, null, item.name(), Instant.now());
        }
        if (item.err() != null && !item.err().isBlank() && DeviceUpReport.OK.equals(item.err())) {
            return new ValueResult(PointDataState.ERROR, null, item.name(), Instant.now());
        }
        if (Strings.isBlank(item.value())) {
            return new ValueResult(PointDataState.ERROR, null, item.name(), Instant.now());
        }
        return new ValueResult(PointDataState.NORMAL, item.value(), item.name(), Instant.now());
    }

    private static ValueResult mockAnalysisValue(DeviceUpReport.ReadDataItem readDataItem) {
        // todo 测试数据 — 基于正弦波 + 小随机扰动
        // 用 pointCode 的 hashCode 作为相位偏移,让不同点位曲线不同步
        Instant now = Instant.now();
        double t = now.getEpochSecond() / 60.0;
        double phase = (readDataItem.name().hashCode() & 0xFFFF) / 65536.0 * 2 * Math.PI;
        double base = 50 + 30 * Math.sin(t * 2 * Math.PI / 60 + phase);
        double noise = (Math.random() - 0.5) * 6;
        double doubleValue = Math.max(0, Math.min(100, base + noise));
        return new ValueResult(PointDataState.NORMAL, String.valueOf(doubleValue), readDataItem.name(), now);
    }


    private static void setFillTypedValue(@NotNull DataEntity.DataEntityBuilder<?, ?> data, @NotNull PointEntity point, String value) {

        if (Strings.isBlank(value)) {
            data.stringValue(value);
            return;
        }

        DataType dataType = point.getDataType();

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
                    double doubleValue = Double.parseDouble(value.trim());

                    // 根据精度处理
                    double rounded =
                            Math.round(doubleValue * Math.pow(10, point.getPrecision())) / Math.pow(10, point.getPrecision());

                    data.doubleValue(rounded);

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
        DeviceUpReport report = event.payload().report();
        DeviceUpReport.DeviceUpParams params = report.params();
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

        List<ValueResult> resultList = params.data().stream()
//                .map(DeviceDataApp::analysisValue)
                .map(DeviceDataApp::mockAnalysisValue)
                .toList();

        for (DeviceEntity device : devices) {
            updateData(resultList, device);
            updateDevice(device);
        }
    }


    // ==================== 内部工具 ====================

    private void updateDevice(DeviceEntity device) {
        deviceService.heartByGatewayId(device.getGatewayId());
    }

    private void updateData(List<ValueResult> resultList, DeviceEntity device) {
        List<ValueResult> rData = resultList;
        if (rData == null || rData.isEmpty()) {
            return;
        }

        // 按 pointCode 索引该设备下所有点位定义
        List<PointEntity> points = deviceService.queryPointsByDeviceId(device.getId());


        for (ValueResult valueResult : resultList) {
            points.stream()
                    .filter(p -> p.getPointCode().equals(valueResult.name()))
                    .findFirst()
                    .flatMap(point -> buildData(device, point, valueResult)).ifPresent(dataService::save);
        }

    }


    private static Optional<DataEntity> buildData(DeviceEntity device, PointEntity point, ValueResult valueResult) {

        DataEntity.DataEntityBuilder<?, ?> builder = DataEntity.builder()
                .deviceId(device.getId())
                .deviceName(device.getDeviceName())
                .pointCode(point.getPointCode())
                .pointId(point.getPointCode())  // 兼容：pointId 也填 pointCode
                .pointName(point.getPointName())
                .unit(point.getUnit())
                .dataType(point.getDataType())
                .timestamp(valueResult.timestamp())
                .ingestedAt(Instant.now())
                .dataState(valueResult.state());

        setFillTypedValue(builder, point, valueResult.value()); // todo 测试数据

        DataEntity data = builder.build();

        return Optional.of(data);
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
            String value,
            String name,
            Instant timestamp
    ) {
    }
}
