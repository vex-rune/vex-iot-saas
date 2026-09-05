package com.vex.iot.api.http;

import com.vex.iot.common.response.Response;
import com.vex.iot.domain.schedule.ScheduleRuleService;
import com.vex.iot.domain.schedule.model.DeviceScheduleDetail;
import com.vex.iot.domain.schedule.model.DeviceScheduleRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * 设备定时控制
 */
@RestController
@RequiredArgsConstructor
public class ScheduleApi {

    private final ScheduleRuleService scheduleService;

    /**
     * 按设备查询定时规则列表
     */
    @GetMapping("/api/devices/{deviceId}/schedules")
    public Response<List<DeviceScheduleDetail>> listByDevice(@PathVariable String deviceId) {
        return Response.ok(scheduleService.listByDevice(deviceId));
    }

    /**
     * 单条规则详情
     */
    @GetMapping("/api/schedules/{id}")
    public Response<DeviceScheduleDetail> get(@PathVariable String id) {
        return Response.ok(scheduleService.get(id));
    }

    /**
     * 创建或更新一条规则（含其下动作）
     */
    @PostMapping("/api/schedules")
    public Response<DeviceScheduleDetail> save(@Valid @RequestBody DeviceScheduleRequest body) {
        return Response.ok(scheduleService.save(body));
    }

    /**
     * 删除规则
     */
    @DeleteMapping("/api/schedules/{id}")
    public Response<Void> delete(@PathVariable String id) {
        scheduleService.deleteRule(id);
        return Response.ok();
    }

    /**
     * 启用/禁用规则
     */
    @PostMapping("/api/schedules/{id}/enabled")
    public Response<Void> setEnabled(@PathVariable String id, @RequestParam boolean enabled) {
        scheduleService.setEnabled(id, enabled);
        return Response.ok();
    }
}
