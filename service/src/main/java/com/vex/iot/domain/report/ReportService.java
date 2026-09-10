package com.vex.iot.domain.report;

import com.vex.iot.domain.report.definition.ReportDefinitionService;
import com.vex.iot.domain.report.engine.ReportQueryTranslator;
import com.vex.iot.domain.report.engine.ReportResultAssembler;
import com.vex.iot.domain.report.model.ReportDefinitionEntity;
import com.vex.iot.domain.report.model.ReportQueryRequest;
import com.vex.iot.domain.report.model.ReportResultDTO;
import com.vex.iot.domain.report.model.ReportSchema;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.List;

/// 报表服务（瘦门面）
/// 职责：编排 definition 查询 + 查询引擎 + 结果装配，不包含任何业务逻辑
@Slf4j
@Service
@RequiredArgsConstructor
public class ReportService {

    private final ReportDefinitionService definitionService;
    private final ReportQueryTranslator translator;
    private final ReportResultAssembler assembler;

    // ─── 定义 CRUD（委托给 definitionService）──────────────────────

    public List<ReportDefinitionEntity> query(com.vex.iot.common.queries.QueriesPageRequest req) {
        return definitionService.query(req);
    }

    public long count(com.vex.iot.common.queries.QueriesPageRequest req) {
        return definitionService.count(req);
    }

    public ReportDefinitionEntity getById(String id) {
        return definitionService.getById(id);
    }

    public ReportDefinitionEntity save(ReportDefinitionEntity entity) {
        return definitionService.save(entity);
    }

    public void delete(String id) {
        definitionService.delete(id);
    }

    // ─── 执行 ──────────────────────────────────────────────

    /// 执行报表查询
    public ReportResultDTO execute(ReportQueryRequest req, boolean isPreview) {
        ReportSchema schema = definitionService.resolveSchema(
                req.getDefinitionId(), req.getSchema());

        // 计算有效行数限制
        int effectiveLimit = resolveLimit(req.getLimit(), isPreview);
        schema.setLimit(effectiveLimit);

        // 自动生成 alias
        assembler.assignAliases(schema);

        // 执行查询
        long start = System.currentTimeMillis();
        List<Object[]> rows = translator.translate(schema, req.getFilters());
        long elapsed = System.currentTimeMillis() - start;

        // 装配结果
        return assembler.assemble(schema, rows, elapsed, effectiveLimit);
    }

    // ─── 内部方法 ──────────────────────────────────────────────

    private int resolveLimit(Integer requestedLimit, boolean isPreview) {
        int max = isPreview ? ReportConstants.PREVIEW_LIMIT : ReportConstants.MAX_EXECUTION_LIMIT;
        if (requestedLimit != null && requestedLimit > 0) {
            return Math.min(requestedLimit, max);
        }
        return max;
    }
}