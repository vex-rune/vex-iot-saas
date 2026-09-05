package com.vex.iot.api.http;

import com.vex.iot.api.http.model.PointSortOrderRequest;
import com.vex.iot.common.queries.QueriesPageRequest;
import com.vex.iot.common.response.Response;
import com.vex.iot.domain.device.DeviceService;
import com.vex.iot.domain.device.model.DeviceEntity;
import com.vex.iot.domain.device.model.DeviceOnlineResponse;
import com.vex.iot.domain.device.model.DevicePanelEntity;
import com.vex.iot.domain.device.model.PointEntity;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * 设备与点位
 */
@RestController
@RequiredArgsConstructor
public class DeviceApi {

    /**
     * 设备定义服务(设备 + 点位定义)
     */
    private final DeviceService deviceService;

    // ==================== 设备 ====================

    /**
     * 设备-条件查询
     *
     * @param req 查询条件
     * @return 设备列表
     */
    @PostMapping("/api/devices/query")
    public Response<List<DeviceEntity>> queryDevices(@Valid @RequestBody QueriesPageRequest req) {
        req.withTenantFilter();
        return Response.ok(deviceService.queryDevices(req));
    }

    /**
     * 设备-数量查询
     *
     * @param req 查询条件
     * @return 设备数量
     */
    @PostMapping("/api/devices/count")
    public Response<Long> countDevices(@Valid @RequestBody QueriesPageRequest req) {
        req.withTenantFilter();
        return Response.ok(deviceService.countDevices(req));
    }

    /**
     * 设备-详情
     *
     * @param id 设备ID
     * @return 设备信息
     */
    @GetMapping("/api/devices/{id}")
    public Response<DeviceEntity> getDevice(@PathVariable String id) {
        return Response.ok(deviceService.getDevice(id));
    }

    /**
     * 设备-创建
     *
     * @param device 设备信息
     * @return 创建后的设备
     */
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','ADMIN','OPERATOR')")
    @PostMapping("/api/devices")
    public Response<DeviceEntity> createDevice(@Valid @RequestBody DeviceEntity device) {
        return Response.ok(deviceService.createDevice(device));
    }

    /**
     * 设备-更新
     *
     * @param id     设备ID
     * @param device 设备信息
     * @return 更新后的设备
     */
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','ADMIN','OPERATOR')")
    @PutMapping("/api/devices/{id}")
    public Response<DeviceEntity> updateDevice(@PathVariable String id, @Valid @RequestBody DeviceEntity device) {
        return Response.ok(deviceService.updateDevice(id, device));
    }

    /**
     * 设备-启用/停用
     * 仅切换 enabled 字段，不影响其他属性
     */
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','ADMIN','OPERATOR')")
    @PutMapping("/api/devices/{id}/enabled")
    public Response<DeviceEntity> toggleDeviceEnabled(@PathVariable String id, @RequestBody ToggleEnabledReq body) {
        return Response.ok(deviceService.setDeviceEnabled(id, body.enabled()));
    }

    /**
     * 设备-删除
     *
     * @param id 设备ID
     * @return 操作结果
     */
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','ADMIN')")
    @DeleteMapping("/api/devices/{id}")
    public Response<Void> deleteDevice(@PathVariable String id) {
        deviceService.deleteDevice(id);
        return Response.ok();
    }

    /**
     * 设备-在线状态
     *
     * @param id 设备ID
     * @return 在线状态信息
     */
    @GetMapping("/api/devices/{id}/online")
    public Response<DeviceOnlineResponse> getDeviceOnline(@PathVariable String id) {
        return Response.ok(deviceService.getDeviceOnlineStatus(id));
    }

    /**
     * 设备-点位条件查询
     *
     * @param req 查询条件
     * @return 点位定义列表
     */
    @PostMapping("/api/devices/points/query")
    public Response<List<PointEntity>> queryPoints(@Valid @RequestBody QueriesPageRequest req) {
        req.withTenantFilter();
        return Response.ok(deviceService.queryPoints(req));
    }

    // ==================== 点位 ====================

    /**
     * 设备-点位数量查询
     *
     * @param req 查询条件
     * @return 点位定义数量
     */
    @PostMapping("/api/devices/points/count")
    public Response<Long> countPoints(@Valid @RequestBody QueriesPageRequest req) {
        req.withTenantFilter();
        return Response.ok(deviceService.countPoints(req));
    }

    /**
     * 设备-点位列表
     *
     * @param deviceId 设备ID
     * @return 该设备下点位定义列表
     */
    @GetMapping("/api/devices/{deviceId}/points")
    public Response<List<PointEntity>> listPointsByDevice(@PathVariable String deviceId) {
        return Response.ok(deviceService.listPointsByDevice(deviceId));
    }

    /**
     * 设备-点位保存
     *
     * @param def 点位定义
     * @return 保存后的点位定义
     */
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','ADMIN','OPERATOR')")
    @PostMapping("/api/devices/points")
    public Response<PointEntity> savePoint(@Valid @RequestBody PointEntity def) {
        return Response.ok(deviceService.savePoint(def));
    }

    /**
     * 设备-点位删除
     *
     * @param id 点位定义ID
     * @return 操作结果
     */
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','ADMIN')")
    @DeleteMapping("/api/devices/points/{id}")
    public Response<Void> deletePoint(@PathVariable String id) {
        deviceService.deletePoint(id);
        return Response.ok();
    }

    /**
     * 设备-点位排序更新
     *
     * @param deviceId 设备ID
     * @param body     按新顺序排列的点位ID列表
     * @return 操作结果
     */
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','ADMIN','OPERATOR')")
    @PutMapping("/api/devices/{deviceId}/points/sort")
    public Response<Void> updatePointSortOrder(
            @PathVariable String deviceId,
            @Valid @RequestBody PointSortOrderRequest body) {
        deviceService.updatePointSortOrder(deviceId, body.pointIds());
        return Response.ok();
    }

    /**
     * 获取设备面板配置。
     *
     * @param deviceId 设备 ID
     * @return 面板配置（未配置时返回空对象）
     */
    @GetMapping("/api/devices/{deviceId}/panel-config")
    public Response<DevicePanelEntity> getPanelConfig(@PathVariable String deviceId) {
        DevicePanelEntity panel = deviceService.getPanelConfig(deviceId);
        return Response.ok(panel);
    }

    // ==================== 面板配置 ====================

    /**
     * 保存设备面板配置。
     *
     * @param deviceId 设备 ID
     * @param body     请求体,包含 panelConfig 对象(Map 形式)
     * @return 保存后的面板配置
     */
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','ADMIN','OPERATOR')")
    @PutMapping("/api/devices/{deviceId}/panel-config")
    public Response<DevicePanelEntity> savePanelConfig(
            @PathVariable String deviceId,
            @Valid @RequestBody SavePanelConfigRequest body) {
        return Response.ok(deviceService.savePanelConfig(deviceId, body.panelConfig()));
    }

    /**
     * 删除设备面板配置。
     *
     * @param deviceId 设备 ID
     * @return 操作结果
     */
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','ADMIN')")
    @DeleteMapping("/api/devices/{deviceId}/panel-config")
    public Response<Void> deletePanelConfig(@PathVariable String deviceId) {
        deviceService.deletePanelConfig(deviceId);
        return Response.ok();
    }

    public record ToggleEnabledReq(boolean enabled) {
    }

    /**
     * 保存面板配置请求体 — panelConfig 是任意 JSON 对象(由前端 PanelConfig schema 定义)。
     */
    public record SavePanelConfigRequest(Map<String, Object> panelConfig) {
    }
}
