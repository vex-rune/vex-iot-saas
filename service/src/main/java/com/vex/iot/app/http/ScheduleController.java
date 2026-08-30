package com.vex.iot.app.http;

import com.vex.iot.app.http.model.DeviceScheduleDetail;
import com.vex.iot.app.http.model.DeviceScheduleRequest;
import com.vex.iot.domain.audit.annotation.AuditLog;
import com.vex.iot.common.response.Response;
import com.vex.iot.domain.schedule.service.DeviceScheduleServer;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * 设备定时控制
 */
@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
public class ScheduleController {

    private final DeviceScheduleServer scheduleServer;

    /**
     * 按设备查询定时规则列表
     */
    @GetMapping("/devices/{deviceId}/schedules")
    public Response<List<DeviceScheduleDetail>> listByDevice(@PathVariable String deviceId) {
        return Response.ok(scheduleServer.listByDevice(deviceId));
    }

    /**
     * 单条规则详情
     */
    @GetMapping("/schedules/{id}")
    public Response<DeviceScheduleDetail> get(@PathVariable String id) {
        return Response.ok(scheduleServer.get(id));
    }

    /**
     * 创建或更新一条规则（含其下动作）
     */
    @AuditLog(action = "DEVICE_SCHEDULE_SAVE", resourceType = "schedule")
    @PostMapping("/schedules")
    public Response<DeviceScheduleDetail> save(@Valid @RequestBody DeviceScheduleRequest body) {
        return Response.ok(scheduleServer.save(body));
    }

    /**
     * 删除规则
     */
    @AuditLog(action = "DEVICE_SCHEDULE_DELETE", resourceType = "schedule")
    @DeleteMapping("/schedules/{id}")
    public Response<Void> delete(@PathVariable String id) {
        scheduleServer.delete(id);
        return Response.ok();
    }

    /**
     * 启用/禁用规则
     */
    @AuditLog(action = "DEVICE_SCHEDULE_TOGGLE", resourceType = "schedule")
    @PostMapping("/schedules/{id}/enabled")
    public Response<Void> setEnabled(@PathVariable String id, @RequestParam boolean enabled) {
        scheduleServer.setEnabled(id, enabled);
        return Response.ok();
    }
}
