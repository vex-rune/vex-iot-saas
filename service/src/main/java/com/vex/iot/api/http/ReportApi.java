package com.vex.iot.api.http;

import com.vex.iot.common.queries.QueriesPageRequest;
import com.vex.iot.common.response.Response;
import com.vex.iot.domain.report.ReportService;
import com.vex.iot.domain.report.engine.ReportCsvExporter;
import com.vex.iot.domain.report.model.ReportDefinitionEntity;
import com.vex.iot.domain.report.model.ReportQueryRequest;
import com.vex.iot.domain.report.model.ReportResultDTO;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.io.IOException;
import java.util.List;

/// 自定义报表
@RestController
@RequiredArgsConstructor
public class ReportApi {

    private final ReportService reportService;
    private final ReportCsvExporter csvExporter;

    // ─── 配置 CRUD ──────────────────────────────────────────────

    /// 查询报表定义列表
    @PostMapping("/api/report/definitions/query")
    public Response<List<ReportDefinitionEntity>> queryDefinitions(
            @Valid @RequestBody QueriesPageRequest req) {
        return Response.ok(reportService.query(req));
    }

    /// 报表定义数量
    @PostMapping("/api/report/definitions/count")
    public Response<Long> countDefinitions(
            @Valid @RequestBody QueriesPageRequest req) {
        return Response.ok(reportService.count(req));
    }

    /// 获取单个报表定义
    @GetMapping("/api/report/definitions/{id}")
    public Response<ReportDefinitionEntity> getDefinition(@PathVariable String id) {
        return Response.ok(reportService.getById(id));
    }

    /// 创建/更新报表定义
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','ADMIN')")
    @PostMapping("/api/report/definitions")
    public Response<ReportDefinitionEntity> saveDefinition(
            @Valid @RequestBody ReportDefinitionEntity entity) {
        return Response.ok(reportService.save(entity));
    }

    /// 更新报表定义
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','ADMIN')")
    @PutMapping("/api/report/definitions/{id}")
    public Response<ReportDefinitionEntity> updateDefinition(
            @PathVariable String id, @Valid @RequestBody ReportDefinitionEntity entity) {
        entity.setId(id);
        return Response.ok(reportService.save(entity));
    }

    /// 删除报表定义
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','ADMIN')")
    @DeleteMapping("/api/report/definitions/{id}")
    public Response<Void> deleteDefinition(@PathVariable String id) {
        reportService.delete(id);
        return Response.ok();
    }

    // ─── 执行 ──────────────────────────────────────────────

    /// 执行报表查询
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','ADMIN','OPERATOR')")
    @PostMapping("/api/report/execute")
    public Response<ReportResultDTO> execute(
            @Valid @RequestBody ReportQueryRequest req) {
        return Response.ok(reportService.execute(req, false));
    }

    /// 预览报表（限制 100 行）
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','ADMIN','OPERATOR')")
    @PostMapping("/api/report/preview")
    public Response<ReportResultDTO> preview(
            @Valid @RequestBody ReportQueryRequest req) {
        return Response.ok(reportService.execute(req, true));
    }

    /// 导出 CSV
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','ADMIN','OPERATOR')")
    @PostMapping("/api/report/export/csv")
    public void exportCsv(
            @Valid @RequestBody ReportQueryRequest req,
            HttpServletResponse response) throws IOException {
        req.setLimit(5000);
        ReportResultDTO result = reportService.execute(req, false);
        csvExporter.export(result, response);
    }
}