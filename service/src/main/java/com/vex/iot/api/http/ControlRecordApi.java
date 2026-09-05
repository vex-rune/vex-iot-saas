package com.vex.iot.api.http;

import com.vex.iot.common.queries.QueriesPageRequest;
import com.vex.iot.common.response.Response;
import com.vex.iot.domain.device.ControlRecordService;
import com.vex.iot.domain.device.model.ControlRecordEntity;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * 控制记录
 */
@RestController
@RequiredArgsConstructor
public class ControlRecordApi {

    private final ControlRecordService controlRecordService;

    /**
     * 控制记录-条件查询
     *
     * @param req 查询条件
     * @return 控制记录列表
     */
    @PostMapping("/api/control-records/query")
    public Response<List<ControlRecordEntity>> query(@Valid @RequestBody QueriesPageRequest req) {
        return Response.ok(controlRecordService.query(req));
    }

    /**
     * 控制记录-数量查询
     *
     * @param req 查询条件
     * @return 控制记录数量
     */
    @PostMapping("/api/control-records/count")
    public Response<Long> count(@Valid @RequestBody QueriesPageRequest req) {
        return Response.ok(controlRecordService.count(req));
    }

    /**
     * 控制记录-详情
     *
     * @param id 控制记录ID
     * @return 控制记录信息
     */
    @GetMapping("/api/control-records/{id}")
    public Response<ControlRecordEntity> get(@PathVariable String id) {
        return Response.ok(controlRecordService.getById(id));
    }

    /**
     * 控制记录-创建
     *
     * @param record 控制记录信息
     * @return 创建后的控制记录
     */
    @PostMapping("/api/control-records")
    public Response<ControlRecordEntity> create(@Valid @RequestBody ControlRecordEntity record) {
        return Response.ok(controlRecordService.save(record));
    }

    /**
     * 控制记录-删除
     *
     * @param id 控制记录ID
     * @return 操作结果
     */
    @DeleteMapping("/api/control-records/{id}")
    public Response<Void> delete(@PathVariable String id) {
        controlRecordService.delete(id);
        return Response.ok();
    }
}