package com.vex.iot.app.mqtt.sub;

import com.vex.iot.domain.device.model.DeviceEntity;
import com.vex.iot.domain.device.repository.DeviceRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.Optional;

/**
 * 设备查询辅助类
 *
 * <p>给 MQTT 回调线程用。避免在 Subscriber 直接注入 DeviceServer 造成循环。
 *
 * <p>使用静态 holder 注册(只读模式，启动完成后即稳定)。
 */
@Component
@RequiredArgsConstructor
public class DeviceLookupHelper {

    /**
     * 单例实例
     */
    private static volatile DeviceLookupHelper INSTANCE;

    /**
     * 设备仓储
     */
    private final DeviceRepository repository;

    /**
     * 根据设备编码查询设备信息
     *
     * @param deviceCode 设备编码
     * @return 查询结果
     */
    public static LookupResult find(String deviceCode) {
        DeviceLookupHelper h = INSTANCE;
        return h == null ? null : h.lookup(deviceCode);
    }

    /**
     * 查询设备信息
     *
     * @param deviceCode 设备编码
     * @return 设备查询结果
     */
    public LookupResult lookup(String deviceCode) {
        Optional<DeviceEntity> opt = repository.findByDeviceCode(deviceCode);
        return opt.map(d -> new LookupResult(d, d.getTenantId(), d.getDeviceCode())).orElse(null);
    }

    /**
     * 初始化单例
     *
     * @param event 上下文刷新事件
     */
    @org.springframework.context.event.EventListener(
            org.springframework.context.event.ContextRefreshedEvent.class)
    public void init() {
        INSTANCE = this;
    }

    /**
     * 设备查询结果
     *
     * @param device    设备实体
     * @param tenantId 租户ID
     * @param deviceCode 设备编码
     */
    public record LookupResult(DeviceEntity device, String tenantId, String deviceCode) {
    }
}
