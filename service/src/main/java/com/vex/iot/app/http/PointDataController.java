package com.vex.iot.app.http;

import com.vex.iot.domain.audit.annotation.AuditLog;
import com.vex.iot.domain.audit.aspect.AuditWriter;
import com.vex.iot.domain.audit.model.ControlLogEntity;
import com.vex.iot.common.enums.OperationResult;
import com.vex.iot.common.exception.BusinessExceptions.BadRequestException;
import com.vex.iot.common.response.Response;
import com.vex.iot.common.util.UserContext;
import com.vex.iot.domain.pdata.PointControlServer;
import com.vex.iot.domain.pdata.PointQueryServer;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * 点位数据
 */
@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
public class PointDataController {

    private final PointQueryServer pointQueryServer;
    private final AuditWriter auditWriter;
    private final PointControlServer pointControlServer;

    @GetMapping("/devices/{deviceId}/realtime")
    public Response<Map<String, Object>> realtime(@PathVariable String deviceId) {
        return Response.ok(pointQueryServer.realtime(deviceId));
    }

    @GetMapping("/devices/{deviceId}/history")
    public Response<List<Map<String, Object>>> history(@PathVariable String deviceId,
                                                       @RequestParam String pointCode,
                                                       @RequestParam Instant from,
                                                       @RequestParam Instant to,
                                                       @RequestParam(defaultValue = "500") int limit) {
        return Response.ok(pointQueryServer.history(deviceId, pointCode, from, to, limit));
    }

    @AuditLog(action = "POINT_CONTROL", resourceType = "point")
    @PostMapping("/devices/{deviceId}/points/{pointCode}/control")
    public Response<Void> control(@PathVariable String deviceId,
                                   @PathVariable String pointCode,
                                   @RequestBody Map<String, Object> body) {
        Object inputValue = body.get("value");
        if (inputValue == null) {
            throw new BadRequestException("value 不能为空");
        }
        if (inputValue instanceof Map || inputValue instanceof List) {
            throw new BadRequestException("value 类型不合法,仅支持基础类型");
        }
        String username = UserContext.username().orElse(null);
        String tenantId = UserContext.tenantId().orElse(null);
        try {
            pointControlServer.control(deviceId, pointCode, inputValue, tenantId);
            auditWriter.saveControl(ControlLogEntity.builder()
                .id(UUID.randomUUID().toString().replace("-", ""))
                .deviceId(deviceId)
                .pointCode(pointCode)
                .inputValue(String.valueOf(inputValue))
                .writtenValue(String.valueOf(inputValue))
                .username(username)
                .status(OperationResult.SUCCESS)
                .occurredAt(LocalDateTime.ofInstant(Instant.now(), ZoneId.systemDefault()))
                .build());
            return Response.ok();
        } catch (Exception ex) {
            auditWriter.saveControl(ControlLogEntity.builder()
                .id(UUID.randomUUID().toString().replace("-", ""))
                .deviceId(deviceId)
                .pointCode(pointCode)
                .inputValue(String.valueOf(inputValue))
                .username(username)
                .status(OperationResult.FAIL)
                .errorMessage(ex.getMessage())
                .occurredAt(LocalDateTime.ofInstant(Instant.now(), ZoneId.systemDefault()))
                .build());
            throw ex;
        }
    }
}
