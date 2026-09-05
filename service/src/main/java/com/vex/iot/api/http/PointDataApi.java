package com.vex.iot.api.http;

import com.vex.iot.common.queries.QueriesPageRequest;
import com.vex.iot.common.response.Response;
import com.vex.iot.domain.device.DataService;
import com.vex.iot.domain.device.model.DataEntity;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * 点位数据
 */
@RestController
@RequiredArgsConstructor
public class PointDataApi {

    private final DataService dataService;

    /**
     * 数据-条件查询
     *
     * @param req 查询条件
     * @return 数据列表
     */
    @PostMapping("/api/data/query")
    public Response<List<DataEntity>> queryDevices(@Valid @RequestBody QueriesPageRequest req) {
        req.withTenantFilter();
        return Response.ok(dataService.query(req));
    }

    /**
     * 数据-数量查询
     *
     * @param req 查询条件
     * @return 数据数量
     */
    @PostMapping("/api/data/count")
    public Response<Long> count(@Valid @RequestBody QueriesPageRequest req) {
        req.withTenantFilter();
        return Response.ok(dataService.count(req));
    }

    /**
     * 数据-最新数据
     *
     * @param pointId 点位ID
     * @return 数据信息
     */
    @GetMapping("/api/data/{id}")
    public Response<DataEntity> get(@PathVariable("id") String pointId) {
        return Response.ok(dataService.getLatestData(pointId));
    }

    /**
     * 数据-创建
     *
     * @param device 数据信息
     * @return 创建后的数据
     */
    @PostMapping("/api/data")
    public Response<DataEntity> save(@Valid @RequestBody DataEntity device) {
        return Response.ok(dataService.save(device));
    }


}
