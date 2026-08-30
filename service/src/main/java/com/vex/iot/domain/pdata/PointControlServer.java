package com.vex.iot.domain.pdata;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.vex.iot.common.enums.AccessType;
import com.vex.iot.common.enums.DeviceOnline;
import com.vex.iot.common.exception.BusinessExceptions.ForbiddenException;
import com.vex.iot.domain.device.exception.DeviceNotFoundException;
import com.vex.iot.domain.device.exception.DeviceOfflineException;
import com.vex.iot.app.mqtt.exception.MqttPublishException;
import com.vex.iot.domain.device.exception.PointDefinitionNotFoundException;
import com.vex.iot.domain.device.exception.PointReadOnlyException;
import com.vex.iot.domain.device.model.DeviceEntity;
import com.vex.iot.domain.device.repository.DeviceRepository;
import com.vex.iot.domain.device.model.PointDefinitionEntity;
import com.vex.iot.domain.device.repository.PointDefinitionRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;

import java.util.HashMap;
import java.util.Map;

@Slf4j
@Service
@RequiredArgsConstructor
public class PointControlServer {
    private final DeviceRepository deviceRepository;
    private final PointDefinitionRepository pointRepository;
    private final ApplicationEventPublisher eventPublisher;
    private final ObjectMapper objectMapper;

    /**
     * @param operatorId 调用者 userId(从 Controller 通过 UserContext 获取后传入);
     *                   这里通过 tenantId 隔离,禁止跨租户操作。
     */
    public void control(String deviceId, String pointCode, Object inputValue, String operatorTenantId) {
        DeviceEntity device = deviceRepository.findById(deviceId)
                .orElseThrow(DeviceNotFoundException::new);
        if (operatorTenantId != null && device.getTenantId() != null
                && !operatorTenantId.equals(device.getTenantId())) {
            throw new ForbiddenException("不允许操作其他租户的设备");
        }
        if (!device.isEnabled())
            throw new DeviceOfflineException("设备已禁用");
        if (device.getOnline() == DeviceOnline.OFFLINE)
            throw new DeviceOfflineException("设备离线,操作失败");
        PointDefinitionEntity point = pointRepository
                .findByDeviceIdAndPointCode(deviceId, pointCode)
                .orElseThrow(() -> new PointDefinitionNotFoundException(pointCode));
        if (point.getAccess() != AccessType.RW)
            throw new PointReadOnlyException();

        Map<String, Object> payload = new HashMap<>();
        payload.put("pointCode", pointCode);
        payload.put("value", inputValue);
        payload.put("timestamp", System.currentTimeMillis());

        try {
            byte[] body = objectMapper.writeValueAsBytes(payload);
            eventPublisher.publishEvent(new MqttPublishEvent(this, device.getDeviceCode(), body));
            log.info("点位下发成功 deviceCode={} pointCode={} value={}", device.getDeviceCode(), pointCode, inputValue);
        } catch (JsonProcessingException ex) {
            throw new MqttPublishException("下发载荷序列化失败: " + ex.getOriginalMessage(), ex);
        }
    }
}
