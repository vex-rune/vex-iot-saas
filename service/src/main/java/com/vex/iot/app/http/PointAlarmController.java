package com.vex.iot.app.http;

import com.vex.iot.domain.alarm.model.PointAlarmEventEntity;
import com.vex.iot.domain.alarm.model.PointAlarmRuleEntity;
import com.vex.iot.domain.alarm.PointAlarmEventServer;
import com.vex.iot.domain.alarm.PointAlarmRuleServer;
import com.vex.iot.domain.audit.annotation.AuditLog;
import com.vex.iot.common.queries.QueriesPageRequest;
import com.vex.iot.common.response.Response;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/point-alarm")
@RequiredArgsConstructor
public class PointAlarmController {

    private final PointAlarmRuleServer ruleServer;
    private final PointAlarmEventServer eventServer;

    // ==================== 告警规则 ====================

    @GetMapping("/rules/point/{pointDefinitionId}")
    public Response<List<PointAlarmRuleEntity>> listRules(@PathVariable String pointDefinitionId) {
        return Response.ok(ruleServer.listByPointDefinition(pointDefinitionId));
    }

    @GetMapping("/rules/{id}")
    public Response<PointAlarmRuleEntity> getRule(@PathVariable String id) {
        return Response.ok(ruleServer.get(id));
    }

    @AuditLog(action = "POINT_ALARM_RULE_SAVE", resourceType = "point_alarm_rule")
    @PostMapping("/rules")
    public Response<PointAlarmRuleEntity> saveRule(@Valid @RequestBody PointAlarmRuleEntity rule) {
        return Response.ok(ruleServer.save(rule));
    }

    @AuditLog(action = "POINT_ALARM_RULE_DELETE", resourceType = "point_alarm_rule")
    @DeleteMapping("/rules/{id}")
    public Response<Void> deleteRule(@PathVariable String id) {
        ruleServer.delete(id);
        return Response.ok();
    }

    // ==================== 告警事件 ====================

    @GetMapping("/events/point/{pointDefinitionId}")
    public Response<List<PointAlarmEventEntity>> listEventsByPoint(
            @PathVariable String pointDefinitionId) {
        return Response.ok(eventServer.listActiveByPointDefinition(pointDefinitionId));
    }

    @GetMapping("/events/active")
    public Response<Map<String, Object>> listActiveEvents(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        List<PointAlarmEventEntity> events = eventServer.listActiveEvents(page, size);
        long total = eventServer.countActive();
        return Response.ok(Map.of("events", events, "total", total));
    }

    /// 告警事件-条件查询(对齐 /api/alarm/events/query,使用 JpaQueriesExecutor)
    @PostMapping("/events/query")
    public Response<List<PointAlarmEventEntity>> queryEvents(@Valid @RequestBody QueriesPageRequest req) {
        return Response.ok(eventServer.query(req));
    }

    /// 告警事件-数量查询
    @PostMapping("/events/count")
    public Response<Long> countEvents(@Valid @RequestBody QueriesPageRequest req) {
        return Response.ok(eventServer.count(req));
    }

    @GetMapping("/events/{id}")
    public Response<PointAlarmEventEntity> getEvent(@PathVariable String id) {
        return Response.ok(eventServer.get(id));
    }

    @AuditLog(action = "POINT_ALARM_EVENT_ACK", resourceType = "point_alarm_event")
    @PostMapping("/events/{id}/acknowledge")
    public Response<PointAlarmEventEntity> acknowledge(@PathVariable String id) {
        return Response.ok(eventServer.acknowledge(id));
    }
}
