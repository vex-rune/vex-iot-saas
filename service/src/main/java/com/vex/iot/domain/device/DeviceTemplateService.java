package com.vex.iot.domain.device;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.vex.iot.common.exception.BadRequestException;
import com.vex.iot.common.exception.NotFoundException;
import com.vex.iot.common.model.TenantBaseEntity;
import com.vex.iot.common.queries.QueriesPageRequest;
import com.vex.iot.common.queries.jpa.JpaQueriesExecutor;
import com.vex.iot.common.util.IdGenerator;
import com.vex.iot.common.util.UserContext;
import com.vex.iot.domain.device.model.DeviceEntity;
import com.vex.iot.domain.device.model.DevicePanelEntity;
import com.vex.iot.domain.device.model.DeviceTemplateEntity;
import com.vex.iot.domain.device.model.PointEntity;
import com.vex.iot.domain.device.repository.DevicePanelRepository;
import com.vex.iot.domain.device.repository.DeviceRepository;
import com.vex.iot.domain.device.repository.DeviceTemplateRepository;
import com.vex.iot.domain.device.repository.PointDefinitionRepository;
import com.vex.iot.domain.schedule.model.DeviceScheduleEntity;
import com.vex.iot.domain.schedule.repository.DeviceScheduleRepository;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * 设备模版服务：模版 CRUD + 从设备生成模版 + 使用模版创建设备 + 同步模版到关联设备。
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class DeviceTemplateService {

    private final DeviceTemplateRepository templateRepository;
    private final DeviceRepository deviceRepository;
    private final PointDefinitionRepository pointRepository;
    private final DevicePanelRepository panelRepository;
    private final DeviceScheduleRepository scheduleRepository;
    private final ObjectMapper objectMapper;

    @PersistenceContext
    private EntityManager entityManager;

    // ─── 模版查询 ───────────────────────────────────────────────

    public List<DeviceTemplateEntity> queryTemplates(QueriesPageRequest req) {
        return JpaQueriesExecutor.of(DeviceTemplateEntity.class, entityManager).page(req);
    }

    public long countTemplates(QueriesPageRequest req) {
        return JpaQueriesExecutor.of(DeviceTemplateEntity.class, entityManager)
                .count(req != null ? req.getPredicate() : null);
    }

    public DeviceTemplateEntity getTemplate(String id) {
        return templateRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("设备模版不存在: " + id));
    }


    // ─── 模版 CRUD ─────────────────────────────────────────────

    @Transactional
    public DeviceTemplateEntity createTemplate(DeviceTemplateEntity template) {
        Instant now = Instant.now();
        String operator = UserContext.username().orElse(TenantBaseEntity.SYSTEM_USER_ID);
        template.setId(IdGenerator.snowId());
        template.setEnabled(true);
        template.stampCreated(operator, now);
        return templateRepository.save(template);
    }

    @Transactional
    public DeviceTemplateEntity updateTemplate(String id, DeviceTemplateEntity patch) {
        DeviceTemplateEntity existing = getTemplate(id);
        Instant now = Instant.now();
        String operator = UserContext.username().orElse(TenantBaseEntity.SYSTEM_USER_ID);
        if (patch.getTemplateName() != null) existing.setTemplateName(patch.getTemplateName());
        if (patch.getDescription() != null) existing.setDescription(patch.getDescription());
        if (patch.getGatewayType() != null) existing.setGatewayType(patch.getGatewayType());
        if (patch.getPointConfig() != null) existing.setPointConfig(patch.getPointConfig());
        if (patch.getScheduleConfig() != null) existing.setScheduleConfig(patch.getScheduleConfig());
        if (patch.getPanelConfig() != null) existing.setPanelConfig(patch.getPanelConfig());
        existing.stampUpdated(operator, now);
        return templateRepository.save(existing);
    }

    @Transactional
    public void deleteTemplate(String id) {
        templateRepository.deleteById(id);
    }

    // ─── 从设备生成模版 ─────────────────────────────────────────

    @Transactional
    public DeviceTemplateEntity createFromDevice(String deviceId, String templateName, String description) {
        DeviceEntity device = deviceRepository.findById(deviceId)
                .orElseThrow(() -> new NotFoundException("设备不存在: " + deviceId));
        Instant now = Instant.now();
        String operator = UserContext.username().orElse(TenantBaseEntity.SYSTEM_USER_ID);

        List<PointEntity> points = pointRepository.findByDeviceId(deviceId);
        List<DeviceScheduleEntity> schedules = scheduleRepository.findByDeviceId(deviceId);
        Optional<DevicePanelEntity> panel = panelRepository.findByDeviceId(deviceId);

        DeviceTemplateEntity template = DeviceTemplateEntity.builder()
                .id(IdGenerator.snowId())
                .templateName(templateName != null ? templateName : device.getDeviceName() + "-模版")
                .description(description)
                .gatewayType(device.getGatewayType())
                .pointConfig(toJson(points))
                .scheduleConfig(toJson(schedules))
                .panelConfig(panel.map(p -> toJson(p.getPanelConfig())).orElse(null))
                .enabled(true)
                .build();
        template.stampCreated(operator, now);
        return templateRepository.save(template);
    }

    // ─── 使用模版创建设备 ─────────────────────────────────────

    @Transactional
    public DeviceEntity applyTemplate(String templateId, String deviceName, String gatewayId) {
        DeviceTemplateEntity template = getTemplate(templateId);
        Instant now = Instant.now();
        String operator = UserContext.username().orElse(TenantBaseEntity.SYSTEM_USER_ID);

        DeviceEntity device = DeviceEntity.builder()
                .id(IdGenerator.snowId())
                .deviceName(deviceName)
                .gatewayId(gatewayId)
                .gatewayType(template.getGatewayType())
                .templateId(templateId)
                .templateSyncEnabled(true)
                .enabled(true)
                .build();
        device.stampCreated(operator, now);
        DeviceEntity saved = deviceRepository.save(device);
        applyConfigFromTemplate(template, saved.getId(), operator, now);
        return saved;
    }

    // ─── 同步模版到关联设备 ─────────────────────────────────────

    @Transactional
    public List<String> syncTemplateToDevices(String templateId) {
        DeviceTemplateEntity template = getTemplate(templateId);
        List<DeviceEntity> devices = deviceRepository.findByTemplateIdAndTemplateSyncEnabled(templateId, true);
        List<String> syncedIds = new ArrayList<>();
        Instant now = Instant.now();
        String operator = UserContext.username().orElse(TenantBaseEntity.SYSTEM_USER_ID);

        for (DeviceEntity device : devices) {
            replacePointConfig(template, device.getId(), operator, now);
            replaceScheduleConfig(template, device.getId(), operator, now);
            replacePanelConfig(template, device.getId(), operator, now);
            syncedIds.add(device.getId());
        }
        return syncedIds;
    }

    // ─── 工具方法 ─────────────────────────────────────────────

    private void applyConfigFromTemplate(DeviceTemplateEntity tpl, String deviceId,
                                         String operator, Instant now) {
        if (hasContent(tpl.getPointConfig())) {
            List<PointEntity> points = parseList(tpl.getPointConfig(), new TypeReference<>() {
            });
            for (PointEntity p : points) {
                p.setId(IdGenerator.snowId());
                p.setDeviceId(deviceId);
                p.stampCreated(operator, now);
                pointRepository.save(p);
            }
        }
        if (hasContent(tpl.getScheduleConfig())) {
            List<DeviceScheduleEntity> schedules = parseList(tpl.getScheduleConfig(), new TypeReference<>() {
            });
            for (DeviceScheduleEntity s : schedules) {
                s.setId(IdGenerator.snowId());
                s.setDeviceId(deviceId);
                s.setLastFireAt(null);
                s.stampCreated(operator, now);
                scheduleRepository.save(s);
            }
        }
        if (hasContent(tpl.getPanelConfig())) {
            DevicePanelEntity panel = DevicePanelEntity.builder()
                    .id(IdGenerator.snowId()).deviceId(deviceId)
                    .panelConfig(parseMap(tpl.getPanelConfig())).build();
            panel.stampCreated(operator, now);
            panelRepository.save(panel);
        }
    }

    private void replacePointConfig(DeviceTemplateEntity tpl, String deviceId,
                                    String operator, Instant now) {
        if (!hasContent(tpl.getPointConfig())) return;
        pointRepository.findByDeviceId(deviceId).forEach(p -> pointRepository.deleteById(p.getId()));
        for (PointEntity p : parseList(tpl.getPointConfig(), new TypeReference<List<PointEntity>>() {
        })) {
            p.setId(IdGenerator.snowId());
            p.setDeviceId(deviceId);
            p.stampCreated(operator, now);
            pointRepository.save(p);
        }
    }

    private void replaceScheduleConfig(DeviceTemplateEntity tpl, String deviceId,
                                       String operator, Instant now) {
        if (!hasContent(tpl.getScheduleConfig())) return;
        scheduleRepository.findByDeviceId(deviceId).forEach(s -> scheduleRepository.deleteById(s.getId()));
        for (DeviceScheduleEntity s : parseList(tpl.getScheduleConfig(), new TypeReference<List<DeviceScheduleEntity>>() {
        })) {
            s.setId(IdGenerator.snowId());
            s.setDeviceId(deviceId);
            s.setLastFireAt(null);
            s.stampCreated(operator, now);
            scheduleRepository.save(s);
        }
    }

    private void replacePanelConfig(DeviceTemplateEntity tpl, String deviceId,
                                    String operator, Instant now) {
        if (!hasContent(tpl.getPanelConfig())) return;
        panelRepository.findByDeviceId(deviceId).ifPresent(p -> panelRepository.deleteById(p.getId()));
        DevicePanelEntity panel = DevicePanelEntity.builder()
                .id(IdGenerator.snowId()).deviceId(deviceId)
                .panelConfig(parseMap(tpl.getPanelConfig())).build();
        panel.stampCreated(operator, now);
        panelRepository.save(panel);
    }

    private boolean hasContent(String json) {
        return json != null && !json.isBlank();
    }

    private String toJson(Object obj) {
        if (obj == null) return null;
        try {
            return objectMapper.writeValueAsString(obj);
        } catch (JsonProcessingException e) {
            throw new BadRequestException("配置数据序列化失败");
        }
    }

    private <T> List<T> parseList(String json, TypeReference<List<T>> typeRef) {
        try {
            return objectMapper.readValue(json, typeRef);
        } catch (JsonProcessingException e) {
            return new ArrayList<>();
        }
    }

    private Map<String, Object> parseMap(String json) {
        try {
            return objectMapper.readValue(json, new TypeReference<>() {
            });
        } catch (JsonProcessingException e) {
            return null;
        }
    }
}

