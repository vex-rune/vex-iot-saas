package com.vex.iot.domain.device;

import com.vex.iot.common.exception.BusinessExceptions.ConflictException;
import com.vex.iot.common.exception.BusinessExceptions.NotFoundException;
import com.vex.iot.common.model.BaseEntity;
import com.vex.iot.common.util.UserContext;
import com.vex.iot.domain.device.model.PointDefinitionEntity;
import com.vex.iot.domain.device.repository.PointDefinitionRepository;
import com.vex.iot.common.queries.QueriesPageRequest;
import com.vex.iot.common.queries.jpa.JpaQueriesExecutor;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@Slf4j
@Service
@RequiredArgsConstructor
public class PointTableServer {
    private final PointDefinitionRepository repository;

    @PersistenceContext
    private EntityManager entityManager;

    public List<PointDefinitionEntity> query(QueriesPageRequest req) {
        return JpaQueriesExecutor.of(PointDefinitionEntity.class, entityManager).page(req);
    }

    public long count(QueriesPageRequest req) {
        return JpaQueriesExecutor.of(PointDefinitionEntity.class, entityManager).count(
                req != null ? req.getPredicate() : null);
    }

    public List<PointDefinitionEntity> listByDevice(String deviceId) {
        return repository.findByDeviceId(deviceId);
    }

    public PointDefinitionEntity save(PointDefinitionEntity def) {
        LocalDateTime now = LocalDateTime.now();
        String operator = UserContext.username().orElse(BaseEntity.SYSTEM_USER_ID);

        // 校验 deviceId 和 pointCode
        if (def.getDeviceId() == null || def.getDeviceId().isBlank()) {
            throw new IllegalArgumentException("设备ID不能为空");
        }
        if (def.getPointCode() == null || def.getPointCode().isBlank()) {
            throw new IllegalArgumentException("点位编码不能为空");
        }

        // 生成 id: deviceId:pointCode
        String expectedId = def.getDeviceId() + ":" + def.getPointCode();
        boolean isNew = def.getId() == null || def.getId().isBlank();
        if (isNew) {
            def.setId(expectedId);
            if (def.getTenantId() == null || def.getTenantId().isBlank()) {
                def.setTenantId(BaseEntity.DEFAULT_TENANT_ID);
            }
            def.stampCreated(operator, now);
        } else {
            // 更新时校验 id 格式是否正确
            if (!expectedId.equals(def.getId())) {
                throw new IllegalArgumentException("点位ID必须为设备ID:点位编码格式，期望: " + expectedId);
            }
            def.stampUpdated(operator, now);
        }

        // 业务层查重：同设备下 pointCode 必须唯一（不依赖 DB 唯一约束兜底）
        // 新增：查到任何记录都算冲突；更新：查到的记录不是自己才算冲突
        Optional<PointDefinitionEntity> duplicate = repository.findByDeviceIdAndPointCode(def.getDeviceId(), def.getPointCode());
        boolean conflict = duplicate.isPresent() && (isNew || !duplicate.get().getId().equals(def.getId()));
        if (conflict) {
            throw new ConflictException("点位编码「" + def.getPointCode() + "」在该设备下已存在");
        }

        try {
            return repository.save(def);
        } catch (DataIntegrityViolationException ex) {
            // 并发兜底：查重通过后仍可能撞上 DB 唯一约束
            throw new ConflictException("点位编码「" + def.getPointCode() + "」在该设备下已存在");
        }
    }

    public void delete(String id) {
        repository.deleteById(id);
    }

    /**
     * 批量更新设备下点位的排序
     *
     * @param deviceId 设备ID
     * @param pointIds 按新顺序排列的点位ID列表
     */
    @Transactional
    public void updateSortOrder(String deviceId, List<String> pointIds) {
        if (pointIds == null || pointIds.isEmpty()) return;
        List<PointDefinitionEntity> points = repository.findByIdIn(pointIds);
        // 索引化以便按顺序赋 sortOrder
        Map<String, PointDefinitionEntity> byId = new HashMap<>();
        for (PointDefinitionEntity p : points) byId.put(p.getId(), p);
        String operator = UserContext.username().orElse(BaseEntity.SYSTEM_USER_ID);
        LocalDateTime now = LocalDateTime.now();
        for (int i = 0; i < pointIds.size(); i++) {
            PointDefinitionEntity p = byId.get(pointIds.get(i));
            if (p == null) {
                throw new NotFoundException("点位不存在: " + pointIds.get(i));
            }
            if (!deviceId.equals(p.getDeviceId())) {
                throw new ConflictException("点位不属于该设备: " + pointIds.get(i));
            }
            p.setSortOrder(i);
            p.stampUpdated(operator, now);
        }
        repository.saveAll(points);
    }
}
