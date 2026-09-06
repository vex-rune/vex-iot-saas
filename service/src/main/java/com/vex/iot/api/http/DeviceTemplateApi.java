package com.vex.iot.api.http;

import com.vex.iot.common.queries.QueriesPageRequest;
import com.vex.iot.common.response.Response;
import com.vex.iot.domain.device.DeviceTemplateService;
import com.vex.iot.domain.device.model.DeviceEntity;
import com.vex.iot.domain.device.model.DeviceTemplateEntity;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * 设备模版 API
 */
@RestController
@RequiredArgsConstructor
public class DeviceTemplateApi {

    private final DeviceTemplateService templateService;

    /// 模版-条件查询
    @PostMapping("/api/device-templates/query")
    public Response<List<DeviceTemplateEntity>> queryTemplates(@Valid @RequestBody QueriesPageRequest req) {
        req.withTenantFilter();
        return Response.ok(templateService.queryTemplates(req));
    }

    /// 模版-数量查询
    @PostMapping("/api/device-templates/count")
    public Response<Long> countTemplates(@Valid @RequestBody QueriesPageRequest req) {
        req.withTenantFilter();
        return Response.ok(templateService.countTemplates(req));
    }

    /// 模版-详情
    @GetMapping("/api/device-templates/{id}")
    public Response<DeviceTemplateEntity> getTemplate(@PathVariable String id) {
        return Response.ok(templateService.getTemplate(id));
    }

    /// 模版-新建
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','ADMIN')")
    @PostMapping("/api/device-templates")
    public Response<DeviceTemplateEntity> createTemplate(@Valid @RequestBody DeviceTemplateEntity template) {
        return Response.ok(templateService.createTemplate(template));
    }

    /// 模版-更新
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','ADMIN')")
    @PutMapping("/api/device-templates/{id}")
    public Response<DeviceTemplateEntity> updateTemplate(
            @PathVariable String id, @Valid @RequestBody DeviceTemplateEntity template) {
        return Response.ok(templateService.updateTemplate(id, template));
    }

    /// 模版-删除
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','ADMIN')")
    @DeleteMapping("/api/device-templates/{id}")
    public Response<Void> deleteTemplate(@PathVariable String id) {
        templateService.deleteTemplate(id);
        return Response.ok();
    }

    /// 从设备生成模版
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','ADMIN')")
    @PostMapping("/api/device-templates/from-device")
    public Response<DeviceTemplateEntity> createFromDevice(
            @RequestParam String deviceId,
            @RequestParam(required = false) String templateName,
            @RequestParam(required = false) String description) {
        return Response.ok(templateService.createFromDevice(deviceId, templateName, description));
    }

    /// 使用模版创建设备
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','ADMIN','OPERATOR')")
    @PostMapping("/api/device-templates/{id}/apply")
    public Response<DeviceEntity> applyTemplate(
            @PathVariable String id,
            @RequestParam String deviceName,
            @RequestParam(required = false) String gatewayId) {
        return Response.ok(templateService.applyTemplate(id, deviceName, gatewayId));
    }

    /// 同步模版到关联设备
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','ADMIN')")
    @PostMapping("/api/device-templates/{id}/sync")
    public Response<List<String>> syncTemplateToDevices(@PathVariable String id) {
        return Response.ok(templateService.syncTemplateToDevices(id));
    }
}
