package com.vex.iot.api.http;

import com.vex.iot.common.queries.QueriesPageRequest;
import com.vex.iot.common.response.Response;
import com.vex.iot.domain.alarm.AlarmService;
import com.vex.iot.domain.alarm.model.AlarmLogEntity;
import com.vex.iot.domain.alarm.model.AlarmRuleEntity;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * 告警
 */
@RestController
@RequiredArgsConstructor
public class AlarmApi {

    private final AlarmService alarmService;

    /**
     * 告警规则-条件查询
     *
     * @param req 查询条件
     * @return 告警规则列表
     */
    @PostMapping("/api/alarm/rules/query")
    public Response<List<AlarmRuleEntity>> queryRules(@Valid @RequestBody QueriesPageRequest req) {
        req.withTenantFilter();
        return Response.ok(alarmService.queryRules(req));
    }

    /**
     * 告警规则-数量查询
     *
     * @param req 查询条件
     * @return 告警规则数量
     */
    @PostMapping("/api/alarm/rules/count")
    public Response<Long> countRules(@Valid @RequestBody QueriesPageRequest req) {
        req.withTenantFilter();
        return Response.ok(alarmService.countRules(req));
    }

    /**
     * 告警规则-保存
     *
     * @param rule 告警规则
     * @return 保存后的告警规则
     */
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','ADMIN','OPERATOR')")
    @PostMapping("/api/alarm/rules")
    public Response<AlarmRuleEntity> saveRule(@Valid @RequestBody AlarmRuleEntity rule) {
        return Response.ok(alarmService.saveRule(rule));
    }

    /**
     * 告警规则-删除
     *
     * @param id 告警规则ID
     * @return 操作结果
     */
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','ADMIN')")
    @DeleteMapping("/api/alarm/rules/{id}")
    public Response<Void> deleteRule(@PathVariable String id) {
        alarmService.deleteRule(id);
        return Response.ok();
    }

    /**
     * 告警规则-按设备查询
     *
     * @param deviceId 设备ID
     * @return 告警规则列表
     */
    @GetMapping("/api/alarm/rules/by-device/{deviceId}")
    public Response<List<AlarmRuleEntity>> rulesByDevice(@PathVariable String deviceId) {
        return Response.ok(alarmService.listEnabledRulesByDevice(deviceId));
    }

    /**
     * 告警事件-条件查询
     *
     * @param req 查询条件
     * @return 告警事件列表
     */
    @PostMapping("/api/alarm/events/query")
    public Response<List<AlarmLogEntity>> queryEvents(@Valid @RequestBody QueriesPageRequest req) {
        req.withTenantFilter();
        return Response.ok(alarmService.queryEvents(req));
    }

    /**
     * 告警事件-数量查询
     *
     * @param req 查询条件
     * @return 告警事件数量
     */
    @PostMapping("/api/alarm/events/count")
    public Response<Long> countEvents(@Valid @RequestBody QueriesPageRequest req) {
        req.withTenantFilter();
        return Response.ok(alarmService.countEvents(req));
    }

    /**
     * 告警事件-确认
     *
     * @param id 告警事件ID
     * @return 确认后的告警事件
     */
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','ADMIN','OPERATOR')")
    @PostMapping("/api/alarm/events/{id}/ack")
    public Response<AlarmLogEntity> ack(@PathVariable String id) {
        return Response.ok(alarmService.acknowledgeEvent(id));
    }
}
