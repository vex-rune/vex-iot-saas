package com.vex.iot.app.http;

import com.vex.iot.app.http.model.PointSortOrderRequest;
import com.vex.iot.domain.audit.annotation.AuditLog;
import com.vex.iot.common.queries.QueriesPageRequest;
import jakarta.validation.Valid;
import com.vex.iot.common.response.Response;
import com.vex.iot.domain.device.model.PointDefinitionEntity;
import com.vex.iot.domain.device.PointTableServer;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * 点位表
 */
@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
public class PointTableController {

    /**
     * 点位表服务
     */
    private final PointTableServer pointTableServer;

    /**
     * 点位表-条件查询
     *
     * @param req 查询条件
     * @return 点位定义列表
     */
    @PostMapping("/points/query")
    public Response<List<PointDefinitionEntity>> query(@Valid @RequestBody QueriesPageRequest req) {
        return Response.ok(pointTableServer.query(req));
    }

    /**
     * 点位表-数量查询
     *
     * @param req 查询条件
     * @return 点位定义数量
     */
    @PostMapping("/points/count")
    public Response<Long> count(@Valid @RequestBody QueriesPageRequest req) {
        return Response.ok(pointTableServer.count(req));
    }

    /**
     * 点位表-按设备查询
     *
     * @param deviceId 设备ID
     * @return 点位定义列表
     */
    @GetMapping("/devices/{deviceId}/points")
    public Response<List<PointDefinitionEntity>> listByDevice(@PathVariable String deviceId) {
        return Response.ok(pointTableServer.listByDevice(deviceId));
    }

    /**
     * 点位表-保存
     *
     * @param def 点位定义
     * @return 保存后的点位定义
     */
    @AuditLog(action = "POINT_SAVE", resourceType = "point")
    @PostMapping("/points")
    public Response<PointDefinitionEntity> save(@Valid @RequestBody PointDefinitionEntity def) {
        return Response.ok(pointTableServer.save(def));
    }

    /**
     * 点位表-删除
     *
     * @param id 点位定义ID
     * @return 操作结果
     */
    @AuditLog(action = "POINT_DELETE", resourceType = "point")
    @DeleteMapping("/points/{id}")
    public Response<Void> delete(@PathVariable String id) {
        pointTableServer.delete(id);
        return Response.ok();
    }

    /**
     * 点位表-批量更新排序
     *
     * @param deviceId 设备ID
     * @param body 按新顺序排列的点位ID列表
     * @return 操作结果
     */
    @AuditLog(action = "POINT_SORT", resourceType = "point")
    @PutMapping("/devices/{deviceId}/points/sort")
    public Response<Void> updateSortOrder(
            @PathVariable String deviceId,
            @Valid @RequestBody PointSortOrderRequest body) {
        pointTableServer.updateSortOrder(deviceId, body.pointIds());
        return Response.ok();
    }
}
