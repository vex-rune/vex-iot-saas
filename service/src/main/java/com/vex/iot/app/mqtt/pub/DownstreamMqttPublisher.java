package com.vex.iot.app.mqtt.pub;

import com.vex.iot.app.mqtt.config.MqttClientConfig.MqttDownstreamGateway;
import com.vex.iot.app.mqtt.config.MqttClientConfig.MqttTopicBuilder;
import com.vex.iot.app.mqtt.exception.MqttPublishException;
import com.vex.iot.domain.pdata.MqttPublishEvent;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.event.EventListener;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;

/**
 * MQTT下行发布器
 *
 * <p>订阅 MqttPublishEvent，通过 MqttDownstreamGateway 异步发布到 ${deviceCode}/get。
 *
 * <p>发送链路由 PointControlServer 触发，业务侧只管发事件，本类负责实际下发。
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class DownstreamMqttPublisher {

    /**
     * MQTT下行网关
     */
    private final MqttDownstreamGateway gateway;

    /**
     * MQTT主题构建器
     */
    private final MqttTopicBuilder topicBuilder;

    /**
     * 处理MQTT发布事件
     *
     * @param event MQTT发布事件
     */
    @Async
    @EventListener
    public void onPublish(MqttPublishEvent event) {
        String topic = topicBuilder.downTopic(event.getDeviceCode());
        try {
            gateway.send(topic, event.getPayload());
            log.debug("下行消息 topic={} bytes={}", topic, event.getPayload().length);
        } catch (Exception ex) {
            log.error("下行消息发送失败 topic={}", topic, ex);
            throw new MqttPublishException("下行发送失败: " + ex.getMessage(), ex);
        }
    }
}
