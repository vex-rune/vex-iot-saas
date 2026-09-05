package com.vex.iot.app;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.vex.iot.app.mqtt.MqttConnectProperties;
import com.vex.iot.app.mqtt.usr.MqttUsrSendGateway;
import com.vex.iot.domain.device.enums.OperationResult;
import com.vex.iot.domain.device.ControlRecordService;
import com.vex.iot.domain.device.DeviceService;
import com.vex.iot.domain.device.event.DataUpdateEvent;
import com.vex.iot.domain.device.model.ControlRecordEntity;
import com.vex.iot.domain.device.model.DataEntity;
import com.vex.iot.domain.device.model.DeviceEntity;
import com.vex.iot.domain.device.model.PointEntity;
import com.vex.iot.domain.schedule.ScheduleRuleService;
import com.vex.iot.domain.schedule.event.ScheduleFiredEvent;
import com.vex.iot.domain.schedule.model.DeviceScheduleEntity;
import com.vex.iot.domain.schedule.model.ScheduleAction;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.event.EventListener;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.List;
import java.util.Map;

/**
 * 设备定时控制应用服务。
 * <p>监听 {@link ScheduleFiredEvent}，通过 MQTT 下发控制指令，并记录控制记录。
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class DeviceScheduleApp {

    private final ScheduleRuleService ruleService;
    private final DeviceService deviceService;
    private final ControlRecordService controlRecordService;
    private final MqttUsrSendGateway mqttGateway;
    private final ObjectMapper objectMapper;

    /**
     * 监听定时触发事件：遍历动作 → MQTT 下发 → 记录控制记录 → 更新 lastFireAt。
     */
    @Async
    @EventListener
    public void onScheduleFired(ScheduleFiredEvent event) {
        ScheduleFiredEvent.SchedulePayload payload = event.getPayload();
        DeviceScheduleEntity schedule = payload.schedule();
        String deviceId = schedule.getDeviceId();
        List<ScheduleAction> actions = schedule.getActions();

        log.info("[定时触发] scheduleId={} deviceId={} actions={}", schedule.getId(), deviceId, actions.size());

        // 获取设备信息（网关 ID + 设备名称）
        DeviceEntity device = deviceService.getDevice(deviceId);
        String gatewayId = device.getGatewayId();

        // 预查点位列表（用于回填 pointName）
        Map<String, String> pointNameMap = deviceService.queryPointsByDeviceId(deviceId).stream()
                .collect(java.util.stream.Collectors.toMap(PointEntity::getPointCode, PointEntity::getPointName, (a, b) -> a));

        int success = 0, fail = 0;
        for (ScheduleAction action : actions) {
            ControlRecordEntity record = buildRecord(schedule, action, device.getDeviceName(), pointNameMap.get(action.getPointCode()));
            try {
                sendMqttCommand(gatewayId, action);
                record.setStatus(OperationResult.PENDING);
                success++;
            } catch (Exception e) {
                record.setStatus(OperationResult.FAIL);
                record.setErrorMessage(truncate(e.getMessage(), 512));
                fail++;
                log.error("[定时触发] MQTT 下发失败 scheduleId={} pointCode={}", schedule.getId(), action.getPointCode(), e);
            }
            controlRecordService.save(record);
        }

        // 更新 lastFireAt
        schedule.setLastFireAt(payload.fireTime());
        ruleService.saveRule(schedule);

        if (fail > 0) {
            log.warn("[定时触发] 完成 scheduleId={}: 成功 {} 条, 失败 {} 条", schedule.getId(), success, fail);
        } else {
            log.info("[定时触发] 完成 scheduleId={}: 全部成功 {} 条", schedule.getId(), success);
        }
    }

    /**
     * 构建 MQTT 下发 JSON 并发送。
     * <p>报文格式（USR-G771 协议）：
     * <pre>{@code
     * {
     *   "rw_prot": {
     *     "Ver": "1.0.1",
     *     "dir": "down",
     *     "id": "<gatewayId>",
     *     "r_data": [{"name": "<pointCode>"}],
     *     "w_data": [{"name": "<pointCode>", "value": "<valueText>"}]
     *   }
     * }
     * }</pre>
     */
    private void sendMqttCommand(String gatewayId, ScheduleAction action) throws JsonProcessingException {
        Map<String, Object> payload = Map.of(
                "rw_prot", Map.of(
                        "Ver", "1.0.1",
                        "dir", "down",
                        "id", gatewayId,
                        "r_data", List.of(Map.of("name", action.getPointCode())),
                        "w_data", List.of(Map.of("name", action.getPointCode(), "value", action.getValueText()))
                )
        );
        String json = objectMapper.writeValueAsString(payload);
        mqttGateway.sendToMqtt(MqttConnectProperties.SET_TOPIC, json);
        log.debug("[定时触发] MQTT 下发 gatewayId={} pointCode={} value={}", gatewayId, action.getPointCode(), action.getValueText());
    }

    /**
     * 构建控制记录（PENDING 状态，writtenValue/writtenAt 等设备回执后回填）。
     */
    private ControlRecordEntity buildRecord(DeviceScheduleEntity schedule, ScheduleAction action,
                                             String deviceName, String pointName) {
        return ControlRecordEntity.builder()
                .deviceId(schedule.getDeviceId())
                .deviceName(deviceName)
                .pointCode(action.getPointCode())
                .pointName(pointName)
                .inputValue(action.getValueText())
                .username("schedule:" + schedule.getId())
                .occurredAt(Instant.now())
                .build();
    }

    private static String truncate(String s, int maxLen) {
        return (s != null && s.length() > maxLen) ? s.substring(0, maxLen) : s;
    }

    // ==================== 控制回执 ====================

    /**
     * 监听设备数据上报：匹配 PENDING 控制记录，回填 writtenValue + writtenAt。
     * <p>匹配逻辑：deviceId + pointCode 相同 + 状态为 PENDING。
     */
    @Async
    @EventListener(DataUpdateEvent.class)
    public void onDataUpdate(DataUpdateEvent event) {
        DataEntity data = event.data();
        if (data == null || data.getDeviceId() == null || data.getPointCode() == null) return;

        List<ControlRecordEntity> pendingList = controlRecordService.findPending(data.getDeviceId(), data.getPointCode());
        if (pendingList.isEmpty()) return;

        String reportedValue = pickValue(data);
        if (reportedValue == null) return;

        // 匹配最早的 PENDING 记录，设备上报值 == inputValue 时视为回执成功
        for (ControlRecordEntity record : pendingList) {
            if (matches(record.getInputValue(), reportedValue)) {
                controlRecordService.completePending(record, reportedValue);
                return; // 一次上报只匹配一条
            }
        }
    }

    /**
     * 从 DataEntity 中提取上报值（优先 stringValue → doubleValue → intValue）。
     */
    private static String pickValue(DataEntity data) {
        if (data.getStringValue() != null) return data.getStringValue();
        if (data.getDoubleValue() != null) return String.valueOf(data.getDoubleValue());
        if (data.getIntValue() != null) return String.valueOf(data.getIntValue());
        return null;
    }

    /**
     * 判断设备上报值是否匹配下发值（数值场景去掉末尾 .0 比较）。
     */
    private static boolean matches(String expected, String actual) {
        if (expected == null || actual == null) return false;
        // 精确匹配
        if (expected.equals(actual)) return true;
        // 数值容错："100" vs "100.0"
        try {
            return Double.parseDouble(expected) == Double.parseDouble(actual);
        } catch (NumberFormatException e) {
            return false;
        }
    }
}
