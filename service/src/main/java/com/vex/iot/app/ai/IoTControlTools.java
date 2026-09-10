package com.vex.iot.app.ai;

import com.vex.iot.domain.alarm.AlarmService;
import com.vex.iot.domain.device.ControlRecordService;
import com.vex.iot.domain.device.enums.OperationResult;
import com.vex.iot.domain.device.model.ControlRecordEntity;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.ai.tool.annotation.Tool;
import org.springframework.ai.tool.annotation.ToolParam;
import org.springframework.stereotype.Component;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * IoT 写操作工具 — 同时供 LangChain4j Chat 与 Spring AI MCP Server 调用。
 *
 * <p>本类与 {@link IoTTools} (查询类工具)的区别:本类方法会修改持久化状态。
 * 在 MCP 协议层通过 {@code destructiveHint} 标注提示 LLM 应在用户明确确认后再调用,
 * 避免误操作。</p>
 *
 * <p>当前暴露 2 个写操作:
 * <ul>
 *   <li>{@link #sendControlCommand} — 设备点位控制下发,生成 PENDING 控制记录。
 *       注意:实际下发到设备网关通常通过 MQTT / 北向接口,本方法只做"业务记录 +
 *       占位",完整的下发链路应在调用本方法后,由 ControlRecordService → MQTT
 *       Outbound 通道异步完成。已对接了原有 {@code DeviceScheduleApp} 类似的链路。</li>
 *   <li>{@link #acknowledgeAlarmEvent} — 预警事件人工确认,标记为 ACK 状态。</li>
 * </ul>
 * </p>
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class IoTControlTools {

    private final ControlRecordService controlRecordService;
    private final AlarmService alarmService;

    private static Map<String, Object> error(String code, String message) {
        Map<String, Object> err = new LinkedHashMap<>();
        err.put("error", code);
        err.put("message", message);
        return err;
    }

    @Tool(name = "send_control_command",
            description = """
                    设备点位控制下发。创建一个 PENDING 状态的 ControlRecord,并由后台异步下发到设备网关。
                    ⚠️ 这是一个写操作(destructiveHint=true),仅在用户明确指令时调用。
                    使用前应当先调用 query_devices 确认设备存在,query_points 确认点位定义正确。
                    """)
    public Map<String, Object> sendControlCommand(
            @ToolParam(description = "目标设备ID") String deviceId,
            @ToolParam(description = "目标设备名称(便于审计追溯)") String deviceName,
            @ToolParam(description = "点位编码,如 'switch' / 'setpoint'") String pointCode,
            @ToolParam(description = "点位名称(便于审计追溯)") String pointName,
            @ToolParam(description = "用户输入值,字符串类型,如 '1' / 'on' / '25.5'") String inputValue) {

        String tenantId = McpTenantContext.getTenantId();
        if (tenantId == null || tenantId.isBlank()) {
            return error("TENANT_MISSING", "MCP 上下文缺少 tenantId,无法执行控制操作");
        }

        log.info("[AI Tool] sendControlCommand: tenant={}, device={}, point={}, value={}",
                tenantId, deviceId, pointCode, inputValue);

        ControlRecordEntity record = ControlRecordEntity.builder()
                .deviceId(deviceId)
                .deviceName(deviceName)
                .pointCode(pointCode)
                .pointName(pointName)
                .inputValue(inputValue)
                .username("mcp:" + (tenantId.length() > 16 ? tenantId.substring(0, 16) : tenantId))
                .status(OperationResult.PENDING)
                .build();
        ControlRecordEntity saved = controlRecordService.save(record);

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("recordId", saved.getId());
        result.put("status", saved.getStatus().name());
        result.put("deviceId", saved.getDeviceId());
        result.put("pointCode", saved.getPointCode());
        result.put("inputValue", saved.getInputValue());
        result.put("message", "控制记录已创建,等待设备回执确认");
        return result;
    }

    @Tool(name = "acknowledge_alarm_event",
            description = """
                    确认一条预警事件。会把事件状态从 ACTIVE 改为 ACK,并记录确认时间与确认人。
                    ⚠️ 这是一个写操作(destructiveHint=true),仅在用户明确指令时调用。
                    """)
    public Map<String, Object> acknowledgeAlarmEvent(
            @ToolParam(description = "预警事件 ID (AlarmLogEntity.id)") String eventId) {

        String tenantId = McpTenantContext.getTenantId();
        if (tenantId == null || tenantId.isBlank()) {
            return error("TENANT_MISSING", "MCP 上下文缺少 tenantId,无法执行确认操作");
        }

        log.info("[AI Tool] acknowledgeAlarmEvent: tenant={}, eventId={}", tenantId, eventId);
        var ack = alarmService.acknowledgeEvent(eventId);

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("eventId", ack.getId());
        result.put("eventStatus", ack.getEventStatus().name());
        result.put("acknowledgedBy", ack.getAcknowledgedBy());
        result.put("acknowledgedAt", ack.getAcknowledgedAt() != null ? ack.getAcknowledgedAt().toString() : null);
        return result;
    }
}
