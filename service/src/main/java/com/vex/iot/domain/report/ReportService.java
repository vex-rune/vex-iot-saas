package com.vex.iot.domain.report;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.vex.iot.common.exception.BadRequestException;
import com.vex.iot.common.model.TenantBaseEntity;
import com.vex.iot.common.queries.QueriesPageRequest;
import com.vex.iot.common.queries.jpa.JpaQueriesExecutor;
import com.vex.iot.common.util.UserContext;
import com.vex.iot.domain.report.engine.ReportQueryTranslator;
import com.vex.iot.domain.report.engine.ReportSchemaValidator;
import com.vex.iot.domain.report.exception.ReportDefinitionNotFoundException;
import com.vex.iot.domain.report.model.*;
import com.vex.iot.domain.report.repository.ReportDefinitionRepository;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.*;
import java.util.regex.Pattern;

/// 报表服务
@Slf4j
@Service
@RequiredArgsConstructor
public class ReportService {

    private static final Pattern NAME_PATTERN = Pattern.compile("^[A-Za-z0-9_\\u4e00-\\u9fa5][A-Za-z0-9_-\\s\\u4e00-\\u9fa5]{0,63}$");
    private static final int MAX_LIMIT = 5000;
    private static final int PREVIEW_LIMIT = 100;

    private final ReportDefinitionRepository repository;
    private final ReportSchemaValidator validator;
    private final ReportQueryTranslator translator;
    private final ObjectMapper objectMapper;
    @PersistenceContext
    private EntityManager entityManager;

    // ─── 配置 CRUD ──────────────────────────────────────────────

    public List<ReportDefinitionEntity> query(QueriesPageRequest req) {
        req.withTenantFilter();
        return JpaQueriesExecutor.of(ReportDefinitionEntity.class, entityManager).page(req);
    }

    public long count(QueriesPageRequest req) {
        req.withTenantFilter();
        return JpaQueriesExecutor.of(ReportDefinitionEntity.class, entityManager)
                .count(req != null ? req.getPredicate() : null);
    }

    public ReportDefinitionEntity getById(String id) {
        ReportDefinitionEntity entity = repository.findById(id)
                .orElseThrow(ReportDefinitionNotFoundException::new);
        checkTenantAccess(entity);
        return entity;
    }

    @Transactional
    public ReportDefinitionEntity save(ReportDefinitionEntity entity) {
        if (entity.getName() == null || entity.getName().isBlank()) {
            throw new BadRequestException("report_invalid_schema", "报表名称不能为空");
        }
        if (!NAME_PATTERN.matcher(entity.getName()).matches()) {
            throw new BadRequestException("report_invalid_schema",
                    "报表名称不合法: " + entity.getName());
        }
        validator.validateSchemaJson(entity.getSchemaJson());
        ReportSchema schema = parseSchema(entity.getSchemaJson());
        validator.validate(schema);

        Instant now = Instant.now();
        String operator = UserContext.username().orElse(TenantBaseEntity.SYSTEM_USER_ID);
        if (entity.getId() == null || entity.getId().isBlank()) {
            entity.stampCreated(operator, now);
        } else {
            ReportDefinitionEntity exist = repository.findById(entity.getId())
                    .orElseThrow(ReportDefinitionNotFoundException::new);
            checkTenantAccess(exist);
            entity.setTenantId(exist.getTenantId());
            entity.setCreatedAt(exist.getCreatedAt());
            entity.setCreateId(exist.getCreateId());
            entity.stampUpdated(operator, now);
        }
        return repository.save(entity);
    }

    @Transactional
    public void delete(String id) {
        ReportDefinitionEntity exist = repository.findById(id)
                .orElseThrow(ReportDefinitionNotFoundException::new);
        checkTenantAccess(exist);
        exist.markDeleted(UserContext.username().orElse(TenantBaseEntity.SYSTEM_USER_ID), Instant.now());
        repository.save(exist);
    }

    // ─── 执行 ──────────────────────────────────────────────

    public ReportResultDTO execute(ReportQueryRequest req, boolean isPreview) {
        ReportSchema schema = resolveSchema(req);
        int effectiveLimit = isPreview ? PREVIEW_LIMIT : MAX_LIMIT;
        if (req.getLimit() != null && req.getLimit() > 0) {
            effectiveLimit = Math.min(req.getLimit(), isPreview ? PREVIEW_LIMIT : MAX_LIMIT);
        }
        schema.setLimit(effectiveLimit);

        long start = System.currentTimeMillis();
        List<Object[]> rows = translator.translate(schema, req.getFilters());
        long elapsed = System.currentTimeMillis() - start;

        boolean truncated = rows.size() >= effectiveLimit;
        List<ReportResultDTO.ColumnInfo> colInfos = new ArrayList<>();
        for (ReportColumnDef col : schema.getColumns()) {
            colInfos.add(new ReportResultDTO.ColumnInfo(col.getAlias(), col.getAgg().name()));
        }
        List<Map<String, Object>> rowMaps = new ArrayList<>();
        for (Object[] row : rows) {
            Map<String, Object> map = new LinkedHashMap<>();
            for (int i = 0; i < colInfos.size() && i < row.length; i++) {
                map.put(colInfos.get(i).getAlias(), row[i]);
            }
            rowMaps.add(map);
        }

        return ReportResultDTO.builder()
                .columns(colInfos)
                .rows(rowMaps)
                .rowCount(rowMaps.size())
                .truncated(truncated)
                .executedAt(Instant.now())
                .elapsedMs(elapsed)
                .build();
    }

    // ─── 内部方法 ──────────────────────────────────────────────

    private ReportSchema resolveSchema(ReportQueryRequest req) {
        if (req.getDefinitionId() != null && !req.getDefinitionId().isBlank()) {
            ReportDefinitionEntity def = getById(req.getDefinitionId());
            if (!def.isEnabled()) {
                throw new BadRequestException("report_invalid_schema", "报表已停用");
            }
            return parseSchema(def.getSchemaJson());
        }
        if (req.getSchema() != null) {
            return req.getSchema();
        }
        throw new BadRequestException("report_invalid_schema", "必须提供 definitionId 或 schema");
    }

    private ReportSchema parseSchema(String json) {
        if (json == null || json.isBlank()) {
            throw new BadRequestException("report_invalid_schema", "schema JSON 为空");
        }
        try {
            return objectMapper.readValue(json, ReportSchema.class);
        } catch (Exception e) {
            throw new BadRequestException("report_invalid_schema", "schema JSON 解析失败: " + e.getMessage());
        }
    }

    private void checkTenantAccess(ReportDefinitionEntity entity) {
        String currentTenant = UserContext.tenantId().orElse(null);
        if (currentTenant == null) return;
        if (!TenantBaseEntity.DEFAULT_TENANT_ID.equals(currentTenant)
                && !Objects.equals(entity.getTenantId(), currentTenant)) {
            throw new ReportDefinitionNotFoundException();
        }
    }
}
