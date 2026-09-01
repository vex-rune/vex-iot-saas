package com.vex.iot.api.http;

import com.vex.iot.domain.audit.annotation.AuditLog;
import com.vex.iot.common.enums.BizType;
import com.vex.iot.common.response.Response;
import com.vex.iot.domain.dashboard.model.DashboardCardEntity;
import com.vex.iot.domain.dashboard.model.DashboardDefinitionEntity;
import com.vex.iot.domain.dashboard.DashboardService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequiredArgsConstructor
public class DashboardApi {

    private final DashboardService dashboardServer;

    // ==================== 仪表盘定义 ====================

    @GetMapping("/api/dashboards/global")
    public Response<List<DashboardDefinitionEntity>> listGlobalDashboards() {
        return Response.ok(dashboardServer.listByBizType(BizType.GLOBAL));
    }

    @GetMapping("/api/dashboards/device/{deviceId}")
    public Response<List<DashboardDefinitionEntity>> listDeviceDashboards(@PathVariable String deviceId) {
        return Response.ok(dashboardServer.listByDevice(deviceId, BizType.DEVICE_DETAIL));
    }

    @GetMapping("/api/dashboards/device/{deviceId}/default")
    public Response<DashboardDefinitionEntity> getDefaultDashboard(@PathVariable String deviceId) {
        return Response.ok(dashboardServer.getDefaultDashboard(deviceId, BizType.DEVICE_DETAIL));
    }

    @GetMapping("/api/dashboards/{id}")
    public Response<DashboardDefinitionEntity> getDashboard(@PathVariable String id) {
        return Response.ok(dashboardServer.get(id));
    }

    @AuditLog(action = "DASHBOARD_SAVE", resourceType = "dashboard")
    @PostMapping("/api/dashboards")
    public Response<DashboardDefinitionEntity> saveDashboard(
            @Valid @RequestBody DashboardDefinitionEntity dashboard) {
        return Response.ok(dashboardServer.save(dashboard));
    }

    @AuditLog(action = "DASHBOARD_DELETE", resourceType = "dashboard")
    @DeleteMapping("/api/dashboards/{id}")
    public Response<Void> deleteDashboard(@PathVariable String id) {
        dashboardServer.delete(id);
        return Response.ok();
    }

    // ==================== 卡片 ====================

    @GetMapping("/api/dashboards/{dashboardId}/cards")
    public Response<List<DashboardCardEntity>> listCards(@PathVariable String dashboardId) {
        return Response.ok(dashboardServer.listCards(dashboardId));
    }

    @GetMapping("/api/dashboards/cards/{id}")
    public Response<DashboardCardEntity> getCard(@PathVariable String id) {
        return Response.ok(dashboardServer.getCard(id));
    }

    @AuditLog(action = "DASHBOARD_CARD_SAVE", resourceType = "dashboard_card")
    @PostMapping("/api/dashboards/cards")
    public Response<DashboardCardEntity> saveCard(@Valid @RequestBody DashboardCardEntity card) {
        return Response.ok(dashboardServer.saveCard(card));
    }

    @AuditLog(action = "DASHBOARD_CARD_DELETE", resourceType = "dashboard_card")
    @DeleteMapping("/api/dashboards/cards/{id}")
    public Response<Void> deleteCard(@PathVariable String id) {
        dashboardServer.deleteCard(id);
        return Response.ok();
    }
}
