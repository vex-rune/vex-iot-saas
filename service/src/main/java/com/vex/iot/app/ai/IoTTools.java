package com.vex.iot.app.ai;

import com.vex.iot.common.queries.*;
import com.vex.iot.domain.alarm.AlarmService;
import com.vex.iot.domain.device.DataService;
import com.vex.iot.domain.device.DeviceService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.ai.tool.annotation.Tool;
import org.springframework.ai.tool.annotation.ToolParam;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;

/**
 * IoT 查询工具 — 同时供 LangChain4j Chat 与 Spring AI MCP Server 使用。
 *
 * <p>方法签名符合 Spring AI MCP Server Boot Starter 的要求:
 * 业务参数通过 {@link ToolParam} 标注为 MCP 工具参数,租户上下文通过 MCP meta 字段
 * (key = "tenantId") 由客户端在调用 tools/call 时随请求一起传入,本服务在
 * {@code McpTenantInterceptor} 中将其绑定到当前请求的 ThreadLocal,工具方法通过
 * {@link McpTenantContext#getTenantId()} 取用,无需作为方法参数暴露给 LLM。</p>
 *
 * <p>多租户隔离的关键:每个 MCP 工具调用都会经过租户上下文注入,确保数据查询严格按
 * 当前调用方所属租户过滤 — 与 HTTP API 走 {@code req.withTenantFilter()} 等价。</p>
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class IoTTools {

    private final DeviceService deviceService;
    private final DataService dataService;
    private final AlarmService alarmService;

    @Tool(name = "query_devices",
            description = "查询设备列表。可按名称、在线状态、启用状态、标签过滤。返回设备信息。")
    public List<?> queryDevices(
            @ToolParam(description = "设备名称（模糊匹配）") String deviceName,
            @ToolParam(description = "在线状态：ONLINE 或 OFFLINE，留空不过滤") String online,
            @ToolParam(description = "是否启用 true/false，留空不过滤") Boolean enabled,
            @ToolParam(description = "一级标签") String level1Tag,
            @ToolParam(description = "返回条数，默认50") Integer limit
    ) {
        String tenantId = McpTenantContext.getTenantId();
        if (tenantId == null) return new ArrayList<>();
        QueriesPageRequest req = buildDevicePredicate(tenantId, deviceName, online, enabled, level1Tag);
        req.setPage(new QueriesPage(0, limit == null ? 50 : limit));
        log.info("[AI Tool] queryDevices: name={}, online={}, enabled={}", deviceName, online, enabled);
        return deviceService.queryDevices(req);
    }

    @Tool(name = "count_devices",
            description = "统计设备数量。可按在线状态、启用状态过滤。")
    public long countDevices(
            @ToolParam(description = "在线状态") String online,
            @ToolParam(description = "是否启用") Boolean enabled) {
        String tenantId = McpTenantContext.getTenantId();
        if (tenantId == null) return 0L;
        QueriesPageRequest req = buildDevicePredicate(tenantId, null, online, enabled, null);
        log.info("[AI Tool] countDevices: online={}, enabled={}", online, enabled);
        return deviceService.countDevices(req);
    }

    @Tool(name = "query_points",
            description = "查询设备的点位定义列表。传入设备ID获取该设备所有监控点位。")
    public List<?> queryPoints(
            @ToolParam(description = "设备ID") String deviceId,
            @ToolParam(description = "点位名称（模糊匹配）") String pointName
    ) {
        String tenantId = McpTenantContext.getTenantId();
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
        req.withTenantFilter(tenantId);
        return deviceService.queryPoints(req);
    }

    @Tool(name = "query_history_data",
            description = "查询设备历史数据。可按设备名称、点位名称、时间范围过滤。查看温度等历史趋势。")
    public List<?> queryHistoryData(
            @ToolParam(description = "设备名称（模糊匹配）") String deviceName,
            @ToolParam(description = "点位名称（模糊匹配）") String pointName,
            @ToolParam(description = "开始时间 ISO 8601") String startTime,
            @ToolParam(description = "结束时间 ISO 8601") String endTime,
            @ToolParam(description = "返回条数，默认50") Integer limit
    ) {
        String tenantId = McpTenantContext.getTenantId();
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
        req.withTenantFilter(tenantId);
        log.info("[AI Tool] queryHistoryData: deviceName={}, pointName={}", deviceName, pointName);
        return dataService.query(req);
    }

    @Tool(name = "query_alarm_events",
            description = "查询预警事件。可按设备ID、级别、状态过滤。")
    public List<?> queryAlarmEvents(
            @ToolParam(description = "设备ID") String deviceId,
            @ToolParam(description = "级别 INFO/WARN/ERROR") String level,
            @ToolParam(description = "状态 ACTIVE/RECOVERED/ACK") String eventStatus,
            @ToolParam(description = "条数") Integer limit
    ) {
        String tenantId = McpTenantContext.getTenantId();
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
        req.withTenantFilter(tenantId);
        log.info("[AI Tool] queryAlarmEvents: deviceId={}, level={}, eventStatus={}", deviceId, level, eventStatus);
        return alarmService.queryEvents(req);
    }

    @Tool(name = "count_alarm_events",
            description = "统计预警事件数量。可按级别、状态过滤。")
    public long countAlarmEvents(
            @ToolParam(description = "设备ID") String deviceId,
            @ToolParam(description = "级别") String level,
            @ToolParam(description = "状态") String eventStatus
    ) {
        String tenantId = McpTenantContext.getTenantId();
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
        req.withTenantFilter(tenantId);
        log.info("[AI Tool] countAlarmEvents: deviceId={}, level={}", deviceId, level);
        return alarmService.countEvents(req);
    }

    @Tool(name = "query_alarm_rules",
            description = "查询预警规则。可按设备ID、名称、启用状态过滤。")
    public List<?> queryAlarmRules(
            @ToolParam(description = "设备ID") String deviceId,
            @ToolParam(description = "规则名称") String ruleName,
            @ToolParam(description = "是否启用") Boolean enabled
    ) {
        String tenantId = McpTenantContext.getTenantId();
        if (tenantId == null) return new ArrayList<>();
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
        req.withTenantFilter(tenantId);
        log.info("[AI Tool] queryAlarmRules: deviceId={}, ruleName={}", deviceId, ruleName);
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
