package com.vex.iot.api.http;

import com.vex.iot.api.http.model.PointSortOrderRequest;
import com.vex.iot.domain.audit.annotation.AuditLog;
import com.vex.iot.common.queries.QueriesPageRequest;
import jakarta.validation.Valid;
import com.vex.iot.common.response.Response;
import com.vex.iot.domain.device.model.DeviceEntity;
import com.vex.iot.domain.device.model.DeviceOnlineResponse;
import com.vex.iot.domain.device.model.PointEntity;
import com.vex.iot.domain.device.DeviceService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

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
    @AuditLog(action = "DEVICE_CREATE", resourceType = "device")
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
    @AuditLog(action = "DEVICE_UPDATE", resourceType = "device")
    @PutMapping("/api/devices/{id}")
    public Response<DeviceEntity> updateDevice(@PathVariable String id, @Valid @RequestBody DeviceEntity device) {
        return Response.ok(deviceService.updateDevice(id, device));
    }

    /**
     * 设备-启用/停用
     * 仅切换 enabled 字段，不影响其他属性
     */
    @AuditLog(action = "DEVICE_TOGGLE_ENABLED", resourceType = "device")
    @PutMapping("/api/devices/{id}/enabled")
    public Response<DeviceEntity> toggleDeviceEnabled(@PathVariable String id, @RequestBody ToggleEnabledReq body) {
        return Response.ok(deviceService.setDeviceEnabled(id, body.enabled()));
    }

    public record ToggleEnabledReq(boolean enabled) {}

    /**
     * 设备-删除
     *
     * @param id 设备ID
     * @return 操作结果
     */
    @AuditLog(action = "DEVICE_DELETE", resourceType = "device")
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

    // ==================== 点位 ====================

    /**
     * 设备-点位条件查询
     *
     * @param req 查询条件
     * @return 点位定义列表
     */
    @PostMapping("/api/devices/points/query")
    public Response<List<PointEntity>> queryPoints(@Valid @RequestBody QueriesPageRequest req) {
        return Response.ok(deviceService.queryPoints(req));
    }

    /**
     * 设备-点位数量查询
     *
     * @param req 查询条件
     * @return 点位定义数量
     */
    @PostMapping("/api/devices/points/count")
    public Response<Long> countPoints(@Valid @RequestBody QueriesPageRequest req) {
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
    @AuditLog(action = "POINT_SAVE", resourceType = "point")
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
    @AuditLog(action = "POINT_DELETE", resourceType = "point")
    @DeleteMapping("/api/devices/points/{id}")
    public Response<Void> deletePoint(@PathVariable String id) {
        deviceService.deletePoint(id);
        return Response.ok();
    }

    /**
     * 设备-点位排序更新
     *
     * @param deviceId 设备ID
     * @param body 按新顺序排列的点位ID列表
     * @return 操作结果
     */
    @AuditLog(action = "POINT_SORT", resourceType = "point")
    @PutMapping("/api/devices/{deviceId}/points/sort")
    public Response<Void> updatePointSortOrder(
            @PathVariable String deviceId,
            @Valid @RequestBody PointSortOrderRequest body) {
        deviceService.updatePointSortOrder(deviceId, body.pointIds());
        return Response.ok();
    }
}
