package com.vex.iot.domain.device;

import com.vex.iot.app.http.model.DeviceOnlineResponse;
import com.vex.iot.common.enums.DeviceOnline;
import com.vex.iot.common.exception.BusinessExceptions.ConflictException;
import com.vex.iot.common.model.BaseEntity;
import com.vex.iot.common.util.IdGenerator;
import com.vex.iot.domain.device.exception.DeviceDuplicateException;
import com.vex.iot.domain.device.exception.DeviceNotFoundException;
import com.vex.iot.domain.device.model.DeviceEntity;
import com.vex.iot.domain.device.repository.DeviceRepository;
import com.vex.iot.common.queries.QueriesPageRequest;
import com.vex.iot.common.queries.jpa.JpaQueriesExecutor;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.event.ContextRefreshedEvent;
import org.springframework.context.event.EventListener;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.List;
import java.util.Optional;

@Slf4j
@Service
@RequiredArgsConstructor
public class DeviceServer {
    private static volatile DeviceServer INSTANCE;
    private final DeviceRepository repository;

    @PersistenceContext
    private EntityManager entityManager;

    /**
     * 静态入口:MQTT 回调线程更新设备在线状态 + 最近心跳。
     */
    public static void markOnlineStatic(String deviceCode) {
        DeviceServer self = INSTANCE;
        if (self == null) return;
        DeviceEntity d = self.repository.findByDeviceCode(deviceCode).orElse(null);
        if (d == null) return;
        LocalDateTime now = LocalDateTime.ofInstant(Instant.now(), ZoneId.systemDefault());
        d.setOnline(DeviceOnline.ONLINE);
        d.setLastHeartbeatAt(now);
        d.stampUpdated(BaseEntity.SYSTEM_USER_ID, now);
        self.repository.save(d);
    }

    private static String resolveCreatorId(String requested) {
        return (requested == null || requested.isBlank()) ? BaseEntity.SYSTEM_USER_ID : requested;
    }

    @EventListener(ContextRefreshedEvent.class)
    public void init() {
        INSTANCE = this;
    }

    public List<DeviceEntity> query(QueriesPageRequest req) {
        return JpaQueriesExecutor.of(DeviceEntity.class, entityManager).page(req);
    }

    public long count(QueriesPageRequest req) {
        return JpaQueriesExecutor.of(DeviceEntity.class, entityManager).count(
                req != null ? req.getPredicate() : null);
    }

    public DeviceEntity get(String id) {
        return repository.findById(id).orElseThrow(DeviceNotFoundException::new);
    }

    public DeviceEntity create(DeviceEntity device) {
        if (repository.findByDeviceCode(device.getDeviceCode()).isPresent()) {
            throw new DeviceDuplicateException(device.getDeviceCode());
        }
        LocalDateTime now = LocalDateTime.ofInstant(Instant.now(), ZoneId.systemDefault());
        device.setId(IdGenerator.snowId());
        device.setOnline(DeviceOnline.OFFLINE);
        if (device.getTenantId() == null || device.getTenantId().isBlank()) {
            device.setTenantId(BaseEntity.DEFAULT_TENANT_ID);
        }
        device.stampCreated(resolveCreatorId(device.getCreateId()), now);
        try {
            return repository.save(device);
        } catch (DataIntegrityViolationException ex) {
            throw new DeviceDuplicateException(device.getDeviceCode());
        }
    }

    public DeviceEntity update(String id, DeviceEntity device) {
        DeviceEntity exist = get(id);
        String newCode = device.getDeviceCode();
        if (newCode == null || newCode.isBlank()) {
            throw new IllegalArgumentException("设备编号不能为空");
        }
        // 设备编号唯一性：可改成与原来相同（自己），但不能改成其他设备的编号
        Optional<DeviceEntity> duplicate = repository.findByDeviceCode(newCode);
        if (duplicate.isPresent() && !duplicate.get().getId().equals(id)) {
            throw new ConflictException("设备编号「" + newCode + "」已被其他设备占用");
        }
        exist.setDeviceName(device.getDeviceName());
        exist.setDeviceCode(newCode);
        exist.setGatewayId(device.getGatewayId());
        exist.setEnabled(device.isEnabled());
        LocalDateTime now = LocalDateTime.ofInstant(Instant.now(), ZoneId.systemDefault());
        exist.stampUpdated(resolveCreatorId(device.getUpdateId()), now);
        try {
            return repository.save(exist);
        } catch (DataIntegrityViolationException ex) {
            // 并发兜底：两台设备同时改同一编号
            throw new ConflictException("设备编号「" + newCode + "」已被其他设备占用");
        }
    }

    public void delete(String id) {
        DeviceEntity exist = get(id);
        LocalDateTime now = LocalDateTime.ofInstant(Instant.now(), ZoneId.systemDefault());
        exist.markDeleted(resolveCreatorId(null), now);
        repository.save(exist);
    }

    /**
     * 启用/停用设备：仅切换 enabled 字段
     */
    public DeviceEntity setEnabled(String id, boolean enabled) {
        DeviceEntity exist = get(id);
        exist.setEnabled(enabled);
        return repository.save(exist);
    }

    public DeviceEntity findByCode(String code) {
        return repository.findByDeviceCode(code)
                .orElseThrow(() -> new DeviceNotFoundException(code));
    }

    /**
     * 获取设备在线状态
     *
     * @param id 设备ID
     * @return 设备在线状态
     */
    public DeviceOnlineResponse getOnlineStatus(String id) {
        DeviceEntity d = get(id);
        return new DeviceOnlineResponse(
            d.getId(),
            d.getDeviceCode(),
            d.getOnline() == DeviceOnline.ONLINE,
            d.isEnabled(),
            d.getLastHeartbeatAt()
        );
    }
}