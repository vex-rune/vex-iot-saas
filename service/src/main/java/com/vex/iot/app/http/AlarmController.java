package com.vex.iot.app.http;

import com.vex.iot.domain.audit.annotation.AuditLog;
import com.vex.iot.common.queries.QueriesPageRequest;
import jakarta.validation.Valid;
import com.vex.iot.domain.alarm.model.AlarmEventEntity;
import com.vex.iot.domain.alarm.model.AlarmRuleEntity;
import com.vex.iot.domain.alarm.AlarmEventServer;
import com.vex.iot.domain.alarm.AlarmRuleServer;
import com.vex.iot.common.response.Response;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * 告警
 */
@RestController
@RequestMapping("/api/alarm")
@RequiredArgsConstructor
public class AlarmController {

    /**
     * 告警规则服务
     */
    private final AlarmRuleServer ruleServer;

    /**
     * 告警事件服务
     */
    private final AlarmEventServer eventServer;

    /**
     * 告警规则-条件查询
     *
     * @param req 查询条件
     * @return 告警规则列表
     */
    @PostMapping("/rules/query")
    public Response<List<AlarmRuleEntity>> queryRules(@Valid @RequestBody QueriesPageRequest req) {
        return Response.ok(ruleServer.query(req));
    }

    /**
     * 告警规则-数量查询
     *
     * @param req 查询条件
     * @return 告警规则数量
     */
    @PostMapping("/rules/count")
    public Response<Long> countRules(@Valid @RequestBody QueriesPageRequest req) {
        return Response.ok(ruleServer.count(req));
    }

    /**
     * 告警规则-保存
     *
     * @param rule 告警规则
     * @return 保存后的告警规则
     */
    @AuditLog(action = "ALARM_RULE_SAVE", resourceType = "alarm_rule")
    @PostMapping("/rules")
    public Response<AlarmRuleEntity> saveRule(@Valid @RequestBody AlarmRuleEntity rule) {
        return Response.ok(ruleServer.save(rule));
    }

    /**
     * 告警规则-删除
     *
     * @param id 告警规则ID
     * @return 操作结果
     */
    @AuditLog(action = "ALARM_RULE_DELETE", resourceType = "alarm_rule")
    @DeleteMapping("/rules/{id}")
    public Response<Void> deleteRule(@PathVariable String id) {
        ruleServer.delete(id);
        return Response.ok();
    }

    /**
     * 告警规则-按设备查询
     *
     * @param deviceId 设备ID
     * @return 告警规则列表
     */
    @GetMapping("/rules/by-device/{deviceId}")
    public Response<List<AlarmRuleEntity>> rulesByDevice(@PathVariable String deviceId) {
        return Response.ok(ruleServer.listByDevice(deviceId));
    }

    /**
     * 告警事件-条件查询
     *
     * @param req 查询条件
     * @return 告警事件列表
     */
    @PostMapping("/events/query")
    public Response<List<AlarmEventEntity>> queryEvents(@Valid @RequestBody QueriesPageRequest req) {
        return Response.ok(eventServer.query(req));
    }

    /**
     * 告警事件-数量查询
     *
     * @param req 查询条件
     * @return 告警事件数量
     */
    @PostMapping("/events/count")
    public Response<Long> countEvents(@Valid @RequestBody QueriesPageRequest req) {
        return Response.ok(eventServer.count(req));
    }

    /**
     * 告警事件-确认
     *
     * @param id 告警事件ID
     * @return 确认后的告警事件
     */
    @PostMapping("/events/{id}/ack")
    public Response<AlarmEventEntity> ack(@PathVariable String id) {
        return Response.ok(eventServer.acknowledge(id));
    }
}
