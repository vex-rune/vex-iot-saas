package com.vex.iot.app.ai;

import com.vex.iot.common.queries.*;
import com.vex.iot.domain.alarm.AlarmService;
import com.vex.iot.domain.device.DataService;
import com.vex.iot.domain.device.DeviceService;
import dev.langchain4j.agent.tool.P;
import dev.langchain4j.agent.tool.Tool;
import dev.langchain4j.invocation.InvocationParameters;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;

/**
 * IoT 查询工具 — 供 LLM 通过 @Tool 自动调用。
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class IoTTools {

    private final DeviceService deviceService;
    private final DataService dataService;
    private final AlarmService alarmService;

    @Tool("查询设备列表。可按名称、在线状态、启用状态、标签过滤。返回设备信息。")
    public List<?> queryDevices(
            InvocationParameters invocationParameters,
            @P("设备名称（模糊匹配）") String deviceName,
            @P("在线状态：ONLINE 或 OFFLINE，留空不过滤") String online,
            @P("是否启用 true/false，留空不过滤") Boolean enabled,
            @P("一级标签") String level1Tag,
            @P("返回条数，默认50") Integer limit
    ) {
        String tenantId = invocationParameters.get("tenantId");
        if (tenantId == null) return new ArrayList<>();
        QueriesPageRequest req = buildDevicePredicate(invocationParameters.getOrDefault("tenantId", null), deviceName, online, enabled, level1Tag);
        req.setPage(new QueriesPage(0, 50));
        log.info("[AI Tool] queryDevices: name={}, online={}, enabled={}", deviceName, online, enabled);
        return deviceService.queryDevices(req);
    }

    @Tool("统计设备数量。可按在线状态、启用状态过滤。")
    public long countDevices(
            InvocationParameters invocationParameters,
            @P("在线状态") String online,
            @P("是否启用") Boolean enabled) {
        String tenantId = invocationParameters.get("tenantId");
        if (tenantId == null) return 0L;
        QueriesPageRequest req = buildDevicePredicate(invocationParameters.getOrDefault("tenantId", null), null, online, enabled, null);
        log.info("[AI Tool] countDevices: online={}, enabled={}", online, enabled);
        return deviceService.countDevices(req);
    }

    @Tool("查询设备的点位定义列表。传入设备ID获取该设备所有监控点位。")
    public List<?> queryPoints(
            InvocationParameters invocationParameters,
            @P("设备ID") String deviceId,
            @P("点位名称（模糊匹配）") String pointName
    ) {
        String tenantId = invocationParameters.get("tenantId");
        if (tenantId == null) return new ArrayList<>();
        QueriesPageRequest req = new QueriesPageRequest();
        var and = new ArrayList<QueriesCriteria>();
        if (deviceId != null && !deviceId.isBlank())
            and.add(QueriesCriteria.of(QueriesCondition.of("deviceId", QueriesOperatorEnum.eq, deviceId)));
        if (pointName != null && !pointName.isBlank())
            and.add(QueriesCriteria.of(QueriesCondition.of("pointName", QueriesOperatorEnum.like, "%" + pointName + "%")));
        if (!and.isEmpty()) {
            var p = new QueriesPredicate();
            p.setAnd(and);
            req.setPredicate(p);
        }
        req.setPage(new QueriesPage(0, 100));
        log.info("[AI Tool] queryPoints: deviceId={}, pointName={}", deviceId, pointName);
        req.withTenantFilter(invocationParameters.getOrDefault("tenantId", null));
        return deviceService.queryPoints(req);
    }

    @Tool("查询设备历史数据。可按设备名称、点位名称、时间范围过滤。查看温度等历史趋势。")
    public List<?> queryHistoryData(
            InvocationParameters invocationParameters,
            @P("设备名称（模糊匹配）") String deviceName,
            @P("点位名称（模糊匹配）") String pointName,
            @P("开始时间 ISO 8601") String startTime,
            @P("结束时间 ISO 8601") String endTime,
            @P("返回条数，默认50") Integer limit
    ) {
        String tenantId = invocationParameters.get("tenantId");
        if (tenantId == null) return new ArrayList<>();
        QueriesPageRequest req = new QueriesPageRequest();
        var and = new ArrayList<QueriesCriteria>();
        if (deviceName != null && !deviceName.isBlank())
            and.add(QueriesCriteria.of(QueriesCondition.of("deviceName", QueriesOperatorEnum.like, "%" + deviceName + "%")));
        if (pointName != null && !pointName.isBlank())
            and.add(QueriesCriteria.of(QueriesCondition.of("pointName", QueriesOperatorEnum.like, "%" + pointName + "%")));
        if (startTime != null && !startTime.isBlank())
            and.add(QueriesCriteria.of(QueriesCondition.of("timestamp", QueriesOperatorEnum.gte, startTime)));
        if (endTime != null && !endTime.isBlank())
            and.add(QueriesCriteria.of(QueriesCondition.of("timestamp", QueriesOperatorEnum.lte, endTime)));
        if (!and.isEmpty()) {
            var p = new QueriesPredicate();
            p.setAnd(and);
            req.setPredicate(p);
        }
        req.setOrder(List.of(new QueriesOrder("timestamp", QueriesOrder.QueriesOrderEnum.DESC)));
        req.setPage(new QueriesPage(0, limit != null ? limit : 50));
        req.withTenantFilter(invocationParameters.getOrDefault("tenantId", null));
        return dataService.query(req);
    }

    @Tool("查询预警事件。可按设备ID、级别、状态过滤。")
    public List<?> queryAlarmEvents(
            InvocationParameters invocationParameters,
            @P("设备ID") String deviceId, @P("级别 INFO/WARN/ERROR") String level,
            @P("状态 ACTIVE/RECOVERED/ACK") String eventStatus, @P("条数") Integer limit
    ) {
        String tenantId = invocationParameters.get("tenantId");
        if (tenantId == null) return new ArrayList<>();
        QueriesPageRequest req = new QueriesPageRequest();
        var and = new ArrayList<QueriesCriteria>();
        if (deviceId != null && !deviceId.isBlank())
            and.add(QueriesCriteria.of(QueriesCondition.of("deviceId", QueriesOperatorEnum.eq, deviceId)));
        if (level != null && !level.isBlank())
            and.add(QueriesCriteria.of(QueriesCondition.of("level", QueriesOperatorEnum.eq, level)));
        if (eventStatus != null && !eventStatus.isBlank())
            and.add(QueriesCriteria.of(QueriesCondition.of("eventStatus", QueriesOperatorEnum.eq, eventStatus)));
        if (!and.isEmpty()) {
            var p = new QueriesPredicate();
            p.setAnd(and);
            req.setPredicate(p);
        }
        req.setOrder(List.of(new QueriesOrder("triggeredAt", QueriesOrder.QueriesOrderEnum.DESC)));
        req.setPage(new QueriesPage(0, limit != null ? limit : 20));
        req.withTenantFilter(invocationParameters.getOrDefault("tenantId", null));
        return alarmService.queryEvents(req);
    }

    @Tool("统计预警事件数量。可按级别、状态过滤。")
    public long countAlarmEvents(
            InvocationParameters invocationParameters,
            @P("设备ID") String deviceId,
            @P("级别") String level,
            @P("状态") String eventStatus
    ) {
        String tenantId = invocationParameters.get("tenantId");
        if (tenantId == null) return 0L;
        QueriesPageRequest req = new QueriesPageRequest();
        var and = new ArrayList<QueriesCriteria>();
        if (deviceId != null && !deviceId.isBlank())
            and.add(QueriesCriteria.of(QueriesCondition.of("deviceId", QueriesOperatorEnum.eq, deviceId)));
        if (level != null && !level.isBlank())
            and.add(QueriesCriteria.of(QueriesCondition.of("level", QueriesOperatorEnum.eq, level)));
        if (eventStatus != null && !eventStatus.isBlank())
            and.add(QueriesCriteria.of(QueriesCondition.of("eventStatus", QueriesOperatorEnum.eq, eventStatus)));
        if (!and.isEmpty()) {
            var p = new QueriesPredicate();
            p.setAnd(and);
            req.setPredicate(p);
        }
        req.withTenantFilter(invocationParameters.getOrDefault("tenantId", null));
        return alarmService.countEvents(req);
    }

    @Tool("查询预警规则。可按设备ID、名称、启用状态过滤。")
    public List<?> queryAlarmRules(
            InvocationParameters invocationParameters,
            @P("设备ID") String deviceId,
            @P("规则名称") String ruleName,
            @P("是否启用") Boolean enabled
    ) {
        QueriesPageRequest req = new QueriesPageRequest();
        var and = new ArrayList<QueriesCriteria>();
        if (deviceId != null && !deviceId.isBlank())
            and.add(QueriesCriteria.of(QueriesCondition.of("deviceId", QueriesOperatorEnum.eq, deviceId)));
        if (ruleName != null && !ruleName.isBlank())
            and.add(QueriesCriteria.of(QueriesCondition.of("ruleName", QueriesOperatorEnum.like, "%" + ruleName + "%")));
        if (enabled != null)
            and.add(QueriesCriteria.of(QueriesCondition.of("enabled", QueriesOperatorEnum.eq, enabled)));
        if (!and.isEmpty()) {
            var p = new QueriesPredicate();
            p.setAnd(and);
            req.setPredicate(p);
        }
        req.setPage(new QueriesPage(0, 50));
        req.withTenantFilter(invocationParameters.getOrDefault("tenantId", null));
        return alarmService.queryRules(req);
    }

    private QueriesPageRequest buildDevicePredicate(
            String tenantId,
            String name,
            String online,
            Boolean enabled,
            String tag
    ) {
        QueriesPageRequest req = new QueriesPageRequest();
        var and = new ArrayList<QueriesCriteria>();
        if (name != null && !name.isBlank())
            and.add(QueriesCriteria.of(QueriesCondition.of("deviceName", QueriesOperatorEnum.like, "%" + name + "%")));
        if (online != null && !online.isBlank())
            and.add(QueriesCriteria.of(QueriesCondition.of("online", QueriesOperatorEnum.eq, online)));
        if (enabled != null)
            and.add(QueriesCriteria.of(QueriesCondition.of("enabled", QueriesOperatorEnum.eq, enabled)));
        if (tag != null && !tag.isBlank())
            and.add(QueriesCriteria.of(QueriesCondition.of("level1Tag", QueriesOperatorEnum.eq, tag)));
        if (!and.isEmpty()) {
            var p = new QueriesPredicate();
            p.setAnd(and);
            req.setPredicate(p);
        }
        req.withTenantFilter(tenantId);
        return req;
    }
}
