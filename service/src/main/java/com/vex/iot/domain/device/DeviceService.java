package com.vex.iot.domain.device;

import com.vex.iot.common.config.DeviceCacheConfig;
import com.vex.iot.common.exception.ConflictException;
import com.vex.iot.common.exception.NotFoundException;
import com.vex.iot.common.model.TenantBaseEntity;
import com.vex.iot.common.queries.QueriesPageRequest;
import com.vex.iot.common.queries.jpa.JpaQueriesExecutor;
import com.vex.iot.common.util.IdGenerator;
import com.vex.iot.common.util.UserContext;
import com.vex.iot.domain.device.enums.DeviceOnline;
import com.vex.iot.domain.device.event.*;
import com.vex.iot.domain.device.exception.DeviceNotFoundException;
import com.vex.iot.domain.device.model.DeviceEntity;
import com.vex.iot.domain.device.model.DeviceOnlineResponse;
import com.vex.iot.domain.device.model.DevicePanelEntity;
import com.vex.iot.domain.device.model.PointEntity;
import com.vex.iot.domain.device.repository.DevicePanelRepository;
import com.vex.iot.domain.device.repository.DeviceRepository;
import com.vex.iot.domain.device.repository.PointDefinitionRepository;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.cache.annotation.CacheConfig;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.Limit;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * 设备定义服务:聚合设备本体 + 点位定义(PointDefinition),统一对外提供 CRUD。
 *
 * <p>由原 {@code DeviceServer} 与 {@code PointTableServer} 合并而成。
 * 设备在线状态的 Redis 缓存仍由本服务持有,通过 {@link CacheConfig} 标注。
 */
@Slf4j
@Service
@CacheConfig(cacheNames = DeviceCacheConfig.DEVICE_ONLINE_STATUS)
@RequiredArgsConstructor
public class DeviceService {

    private final DeviceRepository deviceRepository;
    private final PointDefinitionRepository pointRepository;
    private final DevicePanelRepository panelRepository;
    private final ApplicationEventPublisher applicationEventPublisher;
    private final org.springframework.cache.CacheManager cacheManager;

    @PersistenceContext
    private EntityManager entityManager;

    // ==================== 设备 ====================

    private static String resolveCreatorId(String requested) {
        return (requested == null || requested.isBlank()) ? TenantBaseEntity.SYSTEM_USER_ID : requested;
    }

    public List<DeviceEntity> queryDevices(QueriesPageRequest req) {
        return JpaQueriesExecutor.of(DeviceEntity.class, entityManager).page(req);
    }

    public long countDevices(QueriesPageRequest req) {
        return JpaQueriesExecutor.of(DeviceEntity.class, entityManager).count(
                req != null ? req.getPredicate() : null);
    }

    public DeviceEntity getDevice(String id) {
        return deviceRepository.findById(id).orElseThrow(DeviceNotFoundException::new);
    }

    public List<DeviceEntity> optDeviceByGatewayId(String gatewayId) {
        return deviceRepository.findByGatewayIdAndEnabled(gatewayId, true);
    }

    public DeviceEntity createDevice(DeviceEntity device) {
        Instant now = Instant.now();
        device.setId(IdGenerator.snowId());
        device.setOnline(DeviceOnline.OFFLINE);
        if (device.getTenantId() == null || device.getTenantId().isBlank()) {
            device.setTenantId(TenantBaseEntity.DEFAULT_TENANT_ID);
        }
        device.stampCreated(resolveCreatorId(device.getCreateId()), now);
        DeviceEntity saved = deviceRepository.save(device);
        // 发送"设备创建"事件 — BroadcastApp 将按 tenantId 通过 SSE 广播
        applicationEventPublisher.publishEvent(new DeviceCreatedEvent(saved));
        return saved;
    }

    public DeviceEntity updateDevice(String id, DeviceEntity device) {
        DeviceEntity exist = getDevice(id);
        exist.setDeviceName(device.getDeviceName());
        exist.setGatewayId(device.getGatewayId());
        exist.setEnabled(device.isEnabled());
        exist.setLevel1Tag(device.getLevel1Tag());
        exist.setLevel2Tag(device.getLevel2Tag());
        exist.setLevel3Tag(device.getLevel3Tag());
        Instant now = Instant.now();
        exist.stampUpdated(resolveCreatorId(device.getUpdateId()), now);
        DeviceEntity saved = deviceRepository.save(exist);
        // 发送"设备更新"事件
        applicationEventPublisher.publishEvent(new DeviceUpdatedEvent(saved));
        return saved;
    }

    @CacheEvict(key = "#id")
    public void deleteDevice(String id) {
        DeviceEntity exist = getDevice(id);
        Instant now = Instant.now();
        exist.markDeleted(resolveCreatorId(null), now);
        DeviceEntity saved = deviceRepository.save(exist);
        // 发送"设备删除"事件
        applicationEventPublisher.publishEvent(new DeviceDeletedEvent(saved));
    }

    /**
     * 启用/停用设备:仅切换 enabled 字段
     */
    @CacheEvict(key = "#id")
    public DeviceEntity setDeviceEnabled(String id, boolean enabled) {
        DeviceEntity exist = getDevice(id);
        exist.setEnabled(enabled);
        DeviceEntity saved = deviceRepository.save(exist);
        // 发送"设备启停变更"事件
        applicationEventPublisher.publishEvent(new DeviceEnabledChangedEvent(saved, enabled));
        return saved;
    }

    // ==================== 点位定义 ====================

    /**
     * 获取设备在线状态
     *
     * @param id 设备ID
     * @return 设备在线状态
     */
    @Cacheable(key = "#id")
    public DeviceOnlineResponse getDeviceOnlineStatus(String id) {
        DeviceEntity d = getDevice(id);
        return new DeviceOnlineResponse(
                d.getId(),
                d.getDeviceName(),
                d.getOnline() == DeviceOnline.ONLINE,
                d.isEnabled(),
                d.getLastHeartbeatAt()
        );
    }

    public List<PointEntity> queryPoints(QueriesPageRequest req) {
        return JpaQueriesExecutor.of(PointEntity.class, entityManager).page(req);
    }

    public List<PointEntity> queryPoints(String tenantId, String deviceId, String pointName, int limit) {
        return pointRepository.queryByTenantIdAndDeviceIdAndPointNameLike(tenantId, deviceId, "%" + pointName + "%", Limit.of(limit));
    }

    public long countPoints(QueriesPageRequest req) {
        return JpaQueriesExecutor.of(PointEntity.class, entityManager).count(
                req != null ? req.getPredicate() : null);
    }

    public List<PointEntity> listPointsByDevice(String deviceId) {
        return pointRepository.findByDeviceId(deviceId);
    }

    public PointEntity savePoint(PointEntity def) {
        Instant now = Instant.now();
        String operator = UserContext.username().orElse(TenantBaseEntity.SYSTEM_USER_ID);

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
                def.setTenantId(TenantBaseEntity.DEFAULT_TENANT_ID);
            }
            def.stampCreated(operator, now);
        } else {
            // 更新时校验 id 格式是否正确
            if (!expectedId.equals(def.getId())) {
                throw new IllegalArgumentException("点位ID必须为设备ID:点位编码格式，期望: " + expectedId);
            }
            def.stampUpdated(operator, now);
        }

        // 业务层查重:同设备下 pointCode 必须唯一(不依赖 DB 唯一约束兜底)
        // 新增:查到任何记录都算冲突;更新:查到的记录不是自己才算冲突
        Optional<PointEntity> duplicate = pointRepository.findByDeviceIdAndPointCode(def.getDeviceId(), def.getPointCode());
        boolean isConflict = duplicate.isPresent() && (isNew || !duplicate.get().getId().equals(def.getId()));
        if (isConflict) {
            throw new ConflictException("点位编码「" + def.getPointCode() + "」在该设备下已存在");
        }

        try {
            PointEntity saved = pointRepository.save(def);
            // 发送"点位创建/更新"事件 — BroadcastApp 按 tenantId 通过 SSE 广播
            if (isNew) {
                applicationEventPublisher.publishEvent(new PointCreatedEvent(saved));
            } else {
                applicationEventPublisher.publishEvent(new PointUpdatedEvent(saved));
            }
            return saved;
        } catch (DataIntegrityViolationException ex) {
            // 并发兜底:查重通过后仍可能撞上 DB 唯一约束
            throw new ConflictException("点位编码「" + def.getPointCode() + "」在该设备下已存在");
        }
    }

    public void deletePoint(String id) {
        // 删除前先取实体信息用于事件投递
        PointEntity exist = pointRepository.findById(id).orElse(null);
        pointRepository.deleteById(id);
        if (exist != null) {
            // 发送"点位删除"事件
            applicationEventPublisher.publishEvent(new PointDeletedEvent(exist));
        }
    }

    // ==================== 内部 ====================

    /**
     * 批量更新设备下点位的排序
     *
     * @param deviceId 设备ID
     * @param pointIds 按新顺序排列的点位ID列表
     */
    @Transactional
    public void updatePointSortOrder(String deviceId, List<String> pointIds) {
        if (pointIds == null || pointIds.isEmpty()) return;
        List<PointEntity> points = pointRepository.findByIdIn(pointIds);
        // 索引化以便按顺序赋 sortOrder
        Map<String, PointEntity> byId = new HashMap<>();
        for (PointEntity p : points) byId.put(p.getId(), p);
        String operator = UserContext.username().orElse(TenantBaseEntity.SYSTEM_USER_ID);
        Instant now = Instant.now();
        for (int i = 0; i < pointIds.size(); i++) {
            PointEntity p = byId.get(pointIds.get(i));
            if (p == null) {
                throw new NotFoundException("点位不存在: " + pointIds.get(i));
            }
            if (!deviceId.equals(p.getDeviceId())) {
                throw new ConflictException("点位不属于该设备: " + pointIds.get(i));
            }
            p.setSortOrder(i);
            p.stampUpdated(operator, now);
        }
        pointRepository.saveAll(points);
    }

    public void heartByGatewayId(String gatewayId) {
        deviceRepository.findByGatewayId(gatewayId).forEach(device -> {
            Instant now = Instant.now();
            device.setOnline(DeviceOnline.ONLINE);
            device.setLastHeartbeatAt(now);
            DeviceEntity saved = deviceRepository.save(device);
            evictOnlineCache(saved.getId());
            // 发送"设备心跳"事件（携带 tenantId）— BroadcastApp 按 tenantId 通过 SSE 广播
            applicationEventPublisher.publishEvent(new DeviceHeartbeatEvent(saved));
            log.debug("设备心跳更新: {}", gatewayId);
        });
    }

    public List<PointEntity> queryPointsByDeviceId(String id) {
        return pointRepository.findByDeviceId(id);
    }


    @Transactional
    public void willByGatewayId(String gatewayId) {
        deviceRepository.findByGatewayId(gatewayId).forEach(device -> {
            device.setOnline(DeviceOnline.OFFLINE);
            DeviceEntity saved = deviceRepository.save(device);
            // 发送"设备离线"事件（携带 tenantId）— BroadcastApp 按 tenantId 通过 SSE 广播
            applicationEventPublisher.publishEvent(new DeviceOfflineEvent(saved));
            log.debug("设备离线: {}", gatewayId);
        });
    }

    // ==================== 面板配置 ====================

    /**
     * 获取设备面板配置。
     *
     * @param deviceId 设备 ID
     * @return 面板配置实体（若未配置则返回 null）
     */
    public DevicePanelEntity getPanelConfig(String deviceId) {
        return panelRepository.findByDeviceId(deviceId).orElse(null);
    }

    /**
     * 保存设备面板配置。
     * <p>若设备已有配置则更新，否则新建。
     *
     * @param deviceId    设备 ID
     * @param panelConfig 面板配置(Map 形式;由 Hibernate 自动持久化为 JSONB)
     * @return 保存后的面板配置实体
     */
    @Transactional
    public DevicePanelEntity savePanelConfig(String deviceId, Map<String, Object> panelConfig) {
        // 确保设备存在
        if (!deviceRepository.existsById(deviceId)) {
            throw new DeviceNotFoundException();
        }

        String operator = UserContext.username().orElse(TenantBaseEntity.SYSTEM_USER_ID);
        Instant now = Instant.now();

        DevicePanelEntity panel = panelRepository.findByDeviceId(deviceId)
                .orElseGet(() -> DevicePanelEntity.builder()
                        .deviceId(deviceId)
                        .build());

        // 深拷贝避免与调用方共享引用,防止脏读
        panel.setPanelConfig(panelConfig == null ? null : new java.util.LinkedHashMap<>(panelConfig));

        if (panel.getId() == null) {
            panel.stampCreated(operator, now);
        } else {
            panel.stampUpdated(operator, now);
        }

        return panelRepository.save(panel);
    }

    /**
     * 删除设备面板配置。
     *
     * @param deviceId 设备 ID
     */
    @Transactional
    public void deletePanelConfig(String deviceId) {
        panelRepository.deleteByDeviceId(deviceId);
    }

    /// 清除设备在线状态缓存
    private void evictOnlineCache(String deviceId) {
        org.springframework.cache.Cache cache = cacheManager.getCache(DeviceCacheConfig.DEVICE_ONLINE_STATUS);
        if (cache != null) {
            cache.evict(deviceId);
        }
    }

}