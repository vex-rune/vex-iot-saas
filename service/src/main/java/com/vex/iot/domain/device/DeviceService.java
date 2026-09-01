package com.vex.iot.domain.device;

import com.vex.iot.common.config.DeviceCacheConfig;
import com.vex.iot.common.enums.DeviceOnline;
import com.vex.iot.common.exception.BusinessExceptions.ConflictException;
import com.vex.iot.common.exception.BusinessExceptions.NotFoundException;
import com.vex.iot.common.model.BaseEntity;
import com.vex.iot.common.queries.QueriesPageRequest;
import com.vex.iot.common.queries.jpa.JpaQueriesExecutor;
import com.vex.iot.common.util.IdGenerator;
import com.vex.iot.common.util.UserContext;
import com.vex.iot.domain.device.event.DeviceHeartbeatEvent;
import com.vex.iot.domain.device.event.DeviceOfflineEvent;
import com.vex.iot.domain.device.exception.DeviceNotFoundException;
import com.vex.iot.domain.device.model.DeviceEntity;
import com.vex.iot.domain.device.model.DeviceOnlineResponse;
import com.vex.iot.domain.device.model.PointEntity;
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
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;
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
    private final ApplicationEventPublisher applicationEventPublisher;
    private final org.springframework.cache.CacheManager cacheManager;

    @PersistenceContext
    private EntityManager entityManager;

    // ==================== 设备 ====================

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

    public Optional<DeviceEntity> optDevice(String id) {
        return deviceRepository.findById(id);
    }

    public DeviceEntity createDevice(DeviceEntity device) {
        LocalDateTime now = LocalDateTime.ofInstant(Instant.now(), ZoneId.systemDefault());
        device.setId(IdGenerator.snowId());
        device.setOnline(DeviceOnline.OFFLINE);
        if (device.getTenantId() == null || device.getTenantId().isBlank()) {
            device.setTenantId(BaseEntity.DEFAULT_TENANT_ID);
        }
        device.stampCreated(resolveCreatorId(device.getCreateId()), now);
        return deviceRepository.save(device);
    }

    public DeviceEntity updateDevice(String id, DeviceEntity device) {
        DeviceEntity exist = getDevice(id);
        exist.setDeviceName(device.getDeviceName());
        exist.setGatewayId(device.getGatewayId());
        exist.setEnabled(device.isEnabled());
        exist.setLevel1Tag(device.getLevel1Tag());
        exist.setLevel2Tag(device.getLevel2Tag());
        exist.setLevel3Tag(device.getLevel3Tag());
        LocalDateTime now = LocalDateTime.ofInstant(Instant.now(), ZoneId.systemDefault());
        exist.stampUpdated(resolveCreatorId(device.getUpdateId()), now);
        return deviceRepository.save(exist);
    }

    @CacheEvict(key = "#id")
    public void deleteDevice(String id) {
        DeviceEntity exist = getDevice(id);
        LocalDateTime now = LocalDateTime.ofInstant(Instant.now(), ZoneId.systemDefault());
        exist.markDeleted(resolveCreatorId(null), now);
        deviceRepository.save(exist);
    }

    /**
     * 启用/停用设备:仅切换 enabled 字段
     */
    @CacheEvict(key = "#id")
    public DeviceEntity setDeviceEnabled(String id, boolean enabled) {
        DeviceEntity exist = getDevice(id);
        exist.setEnabled(enabled);
        return deviceRepository.save(exist);
    }

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

    // ==================== 点位定义 ====================

    public List<PointEntity> queryPoints(QueriesPageRequest req) {
        return JpaQueriesExecutor.of(PointEntity.class, entityManager).page(req);
    }

    public long countPoints(QueriesPageRequest req) {
        return JpaQueriesExecutor.of(PointEntity.class, entityManager).count(
                req != null ? req.getPredicate() : null);
    }

    public List<PointEntity> listPointsByDevice(String deviceId) {
        return pointRepository.findByDeviceId(deviceId);
    }

    public PointEntity savePoint(PointEntity def) {
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

        // 业务层查重:同设备下 pointCode 必须唯一(不依赖 DB 唯一约束兜底)
        // 新增:查到任何记录都算冲突;更新:查到的记录不是自己才算冲突
        Optional<PointEntity> duplicate = pointRepository.findByDeviceIdAndPointCode(def.getDeviceId(), def.getPointCode());
        boolean isConflict = duplicate.isPresent() && (isNew || !duplicate.get().getId().equals(def.getId()));
        if (isConflict) {
            throw new ConflictException("点位编码「" + def.getPointCode() + "」在该设备下已存在");
        }

        try {
            return pointRepository.save(def);
        } catch (DataIntegrityViolationException ex) {
            // 并发兜底:查重通过后仍可能撞上 DB 唯一约束
            throw new ConflictException("点位编码「" + def.getPointCode() + "」在该设备下已存在");
        }
    }

    public void deletePoint(String id) {
        pointRepository.deleteById(id);
    }

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
        String operator = UserContext.username().orElse(BaseEntity.SYSTEM_USER_ID);
        LocalDateTime now = LocalDateTime.now();
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

    // ==================== 内部 ====================

    private static String resolveCreatorId(String requested) {
        return (requested == null || requested.isBlank()) ? BaseEntity.SYSTEM_USER_ID : requested;
    }

    public void heart(String gatewayId) {
        deviceRepository.findByGatewayId(gatewayId).forEach(device -> {
            device.setOnline(DeviceOnline.ONLINE);
            device.setLastHeartbeatAt(LocalDateTime.now());
            deviceRepository.save(device);
            evictOnlineCache(device.getId());
            applicationEventPublisher.publishEvent(new DeviceHeartbeatEvent(device.getId()));
            log.debug("设备心跳更新: {}", gatewayId);
        });
    }

    public List<PointEntity> queryPointsByDeviceId(String id) {
        return pointRepository.findByDeviceId(id);
    }

    public void will(String gatewayId) {
        deviceRepository.findByGatewayId(gatewayId).forEach(device -> {
            device.setOnline(DeviceOnline.OFFLINE);
            deviceRepository.save(device);
            applicationEventPublisher.publishEvent(new DeviceOfflineEvent(device.getId()));
            log.debug("设备离线: {}", gatewayId);
        });
    }

    /// 清除设备在线状态缓存
    private void evictOnlineCache(String deviceId) {
        org.springframework.cache.Cache cache = cacheManager.getCache(DeviceCacheConfig.DEVICE_ONLINE_STATUS);
        if (cache != null) {
            cache.evict(deviceId);
        }
    }
}