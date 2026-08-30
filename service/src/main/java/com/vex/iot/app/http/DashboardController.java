package com.vex.iot.app.http;

import com.vex.iot.domain.audit.annotation.AuditLog;
import com.vex.iot.common.enums.BizType;
import com.vex.iot.common.response.Response;
import com.vex.iot.domain.dashboard.model.DashboardCardEntity;
import com.vex.iot.domain.dashboard.model.DashboardDefinitionEntity;
import com.vex.iot.domain.dashboard.DashboardServer;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/dashboards")
@RequiredArgsConstructor
public class DashboardController {

    private final DashboardServer dashboardServer;

    // ==================== 仪表盘定义 ====================

    @GetMapping("/global")
    public Response<List<DashboardDefinitionEntity>> listGlobalDashboards() {
        return Response.ok(dashboardServer.listByBizType(BizType.GLOBAL));
    }

    @GetMapping("/device/{deviceId}")
    public Response<List<DashboardDefinitionEntity>> listDeviceDashboards(@PathVariable String deviceId) {
        return Response.ok(dashboardServer.listByDevice(deviceId, BizType.DEVICE_DETAIL));
    }

    @GetMapping("/device/{deviceId}/default")
    public Response<DashboardDefinitionEntity> getDefaultDashboard(@PathVariable String deviceId) {
        return Response.ok(dashboardServer.getDefaultDashboard(deviceId, BizType.DEVICE_DETAIL));
    }

    @GetMapping("/{id}")
    public Response<DashboardDefinitionEntity> getDashboard(@PathVariable String id) {
        return Response.ok(dashboardServer.get(id));
    }

    @AuditLog(action = "DASHBOARD_SAVE", resourceType = "dashboard")
    @PostMapping
    public Response<DashboardDefinitionEntity> saveDashboard(
            @Valid @RequestBody DashboardDefinitionEntity dashboard) {
        return Response.ok(dashboardServer.save(dashboard));
    }

    @AuditLog(action = "DASHBOARD_DELETE", resourceType = "dashboard")
    @DeleteMapping("/{id}")
    public Response<Void> deleteDashboard(@PathVariable String id) {
        dashboardServer.delete(id);
        return Response.ok();
    }

    // ==================== 卡片 ====================

    @GetMapping("/{dashboardId}/cards")
    public Response<List<DashboardCardEntity>> listCards(@PathVariable String dashboardId) {
        return Response.ok(dashboardServer.listCards(dashboardId));
    }

    @GetMapping("/cards/{id}")
    public Response<DashboardCardEntity> getCard(@PathVariable String id) {
        return Response.ok(dashboardServer.getCard(id));
    }

    @AuditLog(action = "DASHBOARD_CARD_SAVE", resourceType = "dashboard_card")
    @PostMapping("/cards")
    public Response<DashboardCardEntity> saveCard(@Valid @RequestBody DashboardCardEntity card) {
        return Response.ok(dashboardServer.saveCard(card));
    }

    @AuditLog(action = "DASHBOARD_CARD_DELETE", resourceType = "dashboard_card")
    @DeleteMapping("/cards/{id}")
    public Response<Void> deleteCard(@PathVariable String id) {
        dashboardServer.deleteCard(id);
        return Response.ok();
    }
}
