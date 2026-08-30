package com.vex.iot.app.mqtt.sub;

import com.vex.iot.common.model.CurrentUser;
import com.vex.iot.domain.device.DeviceServer;
import com.vex.iot.domain.pdata.parser.UsrG771Parser;
import com.vex.iot.domain.pdata.PointDataServer;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.integration.annotation.ServiceActivator;
import org.springframework.integration.mqtt.support.MqttHeaders;
import org.springframework.messaging.Message;
import org.springframework.stereotype.Component;

/**
 * MQTT上行订阅器
 *
 * <p>Spring Integration：
 * <ul>
 *   <li>监听设备数据主题 (+/update): UsrG771Parser → PointDataServer.ingest</li>
 *   <li>监听心跳主题 (+/heartbeat): 更新设备在线状态</li>
 * </ul>
 *
 * <p>入站适配器由 MqttClientConfig 创建，通过 Channel 路由到本类的 @ServiceActivator 方法。
 * triggerUser 由本订阅器通过 CurrentUser.ofDevice 显式传入下游，避免异步任务依赖 ThreadLocal。
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class UpstreamMqttSubscriber {

    /**
     * USR-G771解析器
     */
    private final UsrG771Parser parser;

    /**
     * 点位数据服务
     */
    private final PointDataServer pointDataServer;

    /**
     * 处理上行消息
     *
     * @param message MQTT消息
     */
    @ServiceActivator(inputChannel = "mqttUpstreamInputChannel")
    public void handleUpstream(Message<byte[]> message) {
        String topic = message.getHeaders().get(MqttHeaders.RECEIVED_TOPIC, String.class);
        try {
            byte[] payload = message.getPayload();
            var parsed = parser.parse(payload);
            DeviceLookupHelper.LookupResult info = DeviceLookupHelper.find(parsed.getDeviceCode());
            if (info == null) {
                log.warn("忽略未注册设备的上行 deviceCode={}", parsed.getDeviceCode());
                return;
            }
            // 设备上行:triggerUser 显式构造,下游异步订阅方不再依赖 ThreadLocal
            CurrentUser triggerUser = CurrentUser.ofDevice(info.tenantId(), info.deviceCode());
            pointDataServer.ingest(triggerUser, parsed);
        } catch (Exception ex) {
            log.warn("上行消息处理失败 topic={}", topic, ex);
        }
    }

    /**
     * 处理心跳消息
     *
     * @param message MQTT消息
     */
    @ServiceActivator(inputChannel = "mqttHeartbeatInputChannel")
    public void handleHeartbeat(Message<byte[]> message) {
        String topic = message.getHeaders().get(MqttHeaders.RECEIVED_TOPIC, String.class);
        try {
            String[] parts = topic.split("/");
            if (parts.length < 2) return;
            // 主题格式: ${deviceCode}/heartbeat, deviceCode 在第一段
            DeviceLookupHelper.LookupResult info = DeviceLookupHelper.find(parts[0]);
            if (info == null) return;
            DeviceServer.markOnlineStatic(info.deviceCode());
        } catch (Exception ex) {
            log.warn("心跳处理失败 topic={}", topic, ex);
        }
    }
}
