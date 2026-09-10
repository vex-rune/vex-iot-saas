package com.vex.iot.domain.report.definition;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.vex.iot.common.exception.BizException;
import com.vex.iot.common.model.TenantBaseEntity;
import com.vex.iot.common.queries.QueriesPageRequest;
import com.vex.iot.common.queries.jpa.JpaQueriesExecutor;
import com.vex.iot.common.util.UserContext;
import com.vex.iot.domain.report.ReportConstants;
import com.vex.iot.domain.report.engine.ReportSchemaValidator;
import com.vex.iot.domain.report.exception.ReportDefinitionNotFoundException;
import com.vex.iot.domain.report.model.ReportDefinitionEntity;
import com.vex.iot.domain.report.model.ReportSchema;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.Objects;
import java.util.regex.Pattern;

/// 报表定义管理服务（CRUD + 校验）
/// 职责：报表定义的增删改查、schema 格式校验、租户访问控制
@Service
@RequiredArgsConstructor
public class ReportDefinitionService {

    private static final Pattern NAME_PATTERN = Pattern.compile(ReportConstants.NAME_REGEX);

    private final ReportDefinitionRepository repository;
    private final ReportSchemaValidator validator;
    private final ObjectMapper objectMapper;

    @PersistenceContext
    private EntityManager entityManager;

    // ─── 查询 ──────────────────────────────────────────────

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

    // ─── 新增/更新 ──────────────────────────────────────────

    @Transactional
    public ReportDefinitionEntity save(ReportDefinitionEntity entity) {
        validateName(entity.getName());
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
            entity.setCreateId(exist.getCreateId());
            entity.setCreatedAt(exist.getCreatedAt());
            entity.stampUpdated(operator, now);
        }
        return repository.save(entity);
    }

    // ─── 删除 ──────────────────────────────────────────────

    @Transactional
    public void delete(String id) {
        ReportDefinitionEntity exist = repository.findById(id)
                .orElseThrow(ReportDefinitionNotFoundException::new);
        checkTenantAccess(exist);
        exist.markDeleted(UserContext.username().orElse(TenantBaseEntity.SYSTEM_USER_ID), Instant.now());
        repository.save(exist);
    }

    // ─── Schema 解析 ──────────────────────────────────────────

    /// 根据请求解析出 ReportSchema（支持 definitionId 或内联 schema）
    public ReportSchema resolveSchema(String definitionId, ReportSchema inlineSchema) {
        if (definitionId != null && !definitionId.isBlank()) {
            ReportDefinitionEntity def = getById(definitionId);
            if (!def.isEnabled()) {
                throw new BizException("report_invalid_schema", "报表已停用");
            }
            return parseSchema(def.getSchemaJson());
        }
        if (inlineSchema != null) {
            return inlineSchema;
        }
        throw new BizException("report_invalid_schema", "必须提供 definitionId 或 schema");
    }

    /// 解析 schema JSON 字符串
    public ReportSchema parseSchema(String json) {
        if (json == null || json.isBlank()) {
            throw new BizException("report_invalid_schema", "schema JSON 为空");
        }
        try {
            return objectMapper.readValue(json, ReportSchema.class);
        } catch (Exception e) {
            throw new BizException("report_invalid_schema", "schema JSON 解析失败: " + e.getMessage());
        }
    }

    // ─── 内部方法 ──────────────────────────────────────────────

    private void validateName(String name) {
        if (name == null || name.isBlank()) {
            throw new BizException("report_invalid_schema", "报表名称不能为空");
        }
        if (!NAME_PATTERN.matcher(name).matches()) {
            throw new BizException("report_invalid_schema", "报表名称不合法: " + name);
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