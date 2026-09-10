package com.vex.iot.app.ai;

import com.vex.iot.common.exception.NotFoundException;
import com.vex.iot.domain.alarm.AlarmService;
import com.vex.iot.domain.alarm.enums.AlarmAckStatus;
import com.vex.iot.domain.alarm.enums.EventStatus;
import com.vex.iot.domain.alarm.model.AlarmLogEntity;
import com.vex.iot.domain.device.ControlRecordService;
import com.vex.iot.domain.device.enums.OperationResult;
import com.vex.iot.domain.device.model.ControlRecordEntity;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.time.Instant;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * IoTControlTools 单元测试 — 不依赖 Spring 上下文,纯 Mockito。
 *
 * <p>覆盖 4 个关键场景:
 * <ol>
 *   <li>无 tenantId 上下文时,所有写操作直接返回错误,不会触达 Service。</li>
 *   <li>控制下发:验证参数正确映射到 ControlRecordEntity 并通过 Service 落库。</li>
 *   <li>告警确认:验证返回的字段(eventStatus / acknowledgedBy / acknowledgedAt)。</li>
 *   <li>告警确认:事件不存在时 {@link NotFoundException} 应透传给 LLM (MCP 客户端报错)。</li>
 * </ol>
 * </p>
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
@DisplayName("IoTControlTools 单元测试")
class IoTControlToolsTest {

    @Mock
    private ControlRecordService controlRecordService;
    @Mock
    private AlarmService alarmService;

    @InjectMocks
    private IoTControlTools tools;

    @BeforeEach
    void setup() {
        McpTenantContext.clear();
    }

    @AfterEach
    void tearDown() {
        McpTenantContext.clear();
    }

    @Test
    @DisplayName("无 tenantId 时 send_control_command 返回错误,不写库")
    void sendControlCommand_withoutTenant_returnsError() {
        Map<String, Object> result = tools.sendControlCommand(
                "device-1", "测试设备", "switch", "开关", "1");

        assertThat(result).containsEntry("error", "TENANT_MISSING");
        verify(controlRecordService, never()).save(any());
    }

    @Test
    @DisplayName("send_control_command 正确填充 ControlRecord 并 save")
    void sendControlCommand_persistsRecord() {
        McpTenantContext.setTenantId("tenant-abc");

        ControlRecordEntity saved = ControlRecordEntity.builder()
                .id("record-1")
                .deviceId("device-1")
                .deviceName("测试设备")
                .pointCode("switch")
                .pointName("开关")
                .inputValue("1")
                .status(OperationResult.PENDING)
                .build();
        when(controlRecordService.save(any(ControlRecordEntity.class))).thenReturn(saved);

        Map<String, Object> result = tools.sendControlCommand(
                "device-1", "测试设备", "switch", "开关", "1");

        assertThat(result).containsEntry("recordId", "record-1");
        assertThat(result).containsEntry("status", "PENDING");
        assertThat(result).containsEntry("deviceId", "device-1");
        assertThat(result).containsEntry("pointCode", "switch");

        // 验证 Service 收到的实体字段映射正确
        ArgumentCaptor<ControlRecordEntity> captor = ArgumentCaptor.forClass(ControlRecordEntity.class);
        verify(controlRecordService).save(captor.capture());
        ControlRecordEntity passed = captor.getValue();
        assertThat(passed.getDeviceId()).isEqualTo("device-1");
        assertThat(passed.getPointCode()).isEqualTo("switch");
        assertThat(passed.getInputValue()).isEqualTo("1");
        assertThat(passed.getStatus()).isEqualTo(OperationResult.PENDING);
        // username 用 tenantId 前缀,便于审计追溯
        assertThat(passed.getUsername()).startsWith("mcp:");
    }

    @Test
    @DisplayName("acknowledge_alarm_event 返回字段映射正确")
    void acknowledgeAlarmEvent_returnsFields() {
        McpTenantContext.setTenantId("tenant-abc");

        Instant ackAt = Instant.parse("2025-01-15T10:00:00Z");
        AlarmLogEntity ack = AlarmLogEntity.builder()
                .id("event-1")
                .tenantId("tenant-abc")
                .eventStatus(EventStatus.ACK)
                .acknowledged(AlarmAckStatus.ACK)
                .acknowledgedBy("admin")
                .acknowledgedAt(ackAt)
                .build();
        when(alarmService.acknowledgeEvent("event-1")).thenReturn(ack);

        Map<String, Object> result = tools.acknowledgeAlarmEvent("event-1");

        assertThat(result).containsEntry("eventId", "event-1");
        assertThat(result).containsEntry("eventStatus", "ACK");
        assertThat(result).containsEntry("acknowledgedBy", "admin");
        assertThat(result).containsEntry("acknowledgedAt", ackAt.toString());
    }

    @Test
    @DisplayName("acknowledge_alarm_event 找不到事件时抛 NotFoundException,被 MCP 层捕获")
    void acknowledgeAlarmEvent_notFound() {
        McpTenantContext.setTenantId("tenant-abc");
        when(alarmService.acknowledgeEvent("missing")).thenThrow(new NotFoundException("预警事件"));

        try {
            tools.acknowledgeAlarmEvent("missing");
        } catch (NotFoundException e) {
            assertThat(e).hasMessageContaining("预警事件");
            return;
        }
        throw new AssertionError("应该抛出 NotFoundException");
    }

    @Test
    @DisplayName("无 tenantId 时 acknowledge_alarm_event 返回错误,不调用 Service")
    void acknowledgeAlarmEvent_withoutTenant_returnsError() {
        Map<String, Object> result = tools.acknowledgeAlarmEvent("event-1");

        assertThat(result).containsEntry("error", "TENANT_MISSING");
        verify(alarmService, never()).acknowledgeEvent(any());
    }
}
