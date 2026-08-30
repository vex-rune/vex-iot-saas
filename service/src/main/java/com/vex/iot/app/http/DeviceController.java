package com.vex.iot.app.http;

import com.vex.iot.app.http.model.DeviceOnlineResponse;
import com.vex.iot.domain.audit.annotation.AuditLog;
import com.vex.iot.common.queries.QueriesPageRequest;
import jakarta.validation.Valid;
import com.vex.iot.common.response.Response;
import com.vex.iot.domain.device.model.DeviceEntity;
import com.vex.iot.domain.device.DeviceServer;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * 设备
 */
@RestController
@RequestMapping("/api/devices")
@RequiredArgsConstructor
public class DeviceController {

    /**
     * 设备服务
     */
    private final DeviceServer deviceServer;

    /**
     * 设备-条件查询
     *
     * @param req 查询条件
     * @return 设备列表
     */
    @PostMapping("/query")
    public Response<List<DeviceEntity>> query(@Valid @RequestBody QueriesPageRequest req) {
        return Response.ok(deviceServer.query(req));
    }

    /**
     * 设备-数量查询
     *
     * @param req 查询条件
     * @return 设备数量
     */
    @PostMapping("/count")
    public Response<Long> count(@Valid @RequestBody QueriesPageRequest req) {
        return Response.ok(deviceServer.count(req));
    }

    /**
     * 设备-详情
     *
     * @param id 设备ID
     * @return 设备信息
     */
    @GetMapping("/{id}")
    public Response<DeviceEntity> get(@PathVariable String id) {
        return Response.ok(deviceServer.get(id));
    }

    /**
     * 设备-创建
     *
     * @param device 设备信息
     * @return 创建后的设备
     */
    @AuditLog(action = "DEVICE_CREATE", resourceType = "device")
    @PostMapping
    public Response<DeviceEntity> create(@Valid @RequestBody DeviceEntity device) {
        return Response.ok(deviceServer.create(device));
    }

    /**
     * 设备-更新
     *
     * @param id     设备ID
     * @param device 设备信息
     * @return 更新后的设备
     */
    @AuditLog(action = "DEVICE_UPDATE", resourceType = "device")
    @PutMapping("/{id}")
    public Response<DeviceEntity> update(@PathVariable String id, @Valid @RequestBody DeviceEntity device) {
        return Response.ok(deviceServer.update(id, device));
    }

    /**
     * 设备-启用/停用
     * 仅切换 enabled 字段，不影响其他属性
     */
    @AuditLog(action = "DEVICE_TOGGLE_ENABLED", resourceType = "device")
    @PutMapping("/{id}/enabled")
    public Response<DeviceEntity> toggleEnabled(@PathVariable String id, @RequestBody ToggleEnabledReq body) {
        return Response.ok(deviceServer.setEnabled(id, body.enabled()));
    }

    public record ToggleEnabledReq(boolean enabled) {}

    /**
     * 设备-删除
     *
     * @param id 设备ID
     * @return 操作结果
     */
    @AuditLog(action = "DEVICE_DELETE", resourceType = "device")
    @DeleteMapping("/{id}")
    public Response<Void> delete(@PathVariable String id) {
        deviceServer.delete(id);
        return Response.ok();
    }

    /**
     * 设备-在线状态
     *
     * @param id 设备ID
     * @return 在线状态信息
     */
    @GetMapping("/{id}/online")
    public Response<DeviceOnlineResponse> online(@PathVariable String id) {
        return Response.ok(deviceServer.getOnlineStatus(id));
    }
}
