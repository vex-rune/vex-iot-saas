package com.vex.iot.app.mqtt.usr;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.jetbrains.annotations.NotNull;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.integration.annotation.ServiceActivator;
import org.springframework.messaging.Message;
import org.springframework.messaging.MessageHandler;

import static com.vex.iot.app.mqtt.MqttConfig.MQTT_INBOUND_CHANNEL;
import static com.vex.iot.app.mqtt.MqttConnectProperties.*;

/**
 * Spring Integration MQTT 完整配置：发布 + 订阅一体
 * doc: https://docs.spring.io/spring-integration/reference/mqtt.html
 */
@Slf4j
@Configuration
public class MqttUsrMessageHandlerConfig {



    /**
     * 消息消费处理器：处理订阅收到的消息
     * inputChannel = mqttInboundChannel
     */
    @Bean("Usr_G770_Mqtt_Receive_Consumer")
    @ServiceActivator(inputChannel = MQTT_INBOUND_CHANNEL)
    public MessageHandler mqttReceiveConsumer(ObjectMapper objectMapper, ApplicationEventPublisher applicationEventPublisher) {
        return (Message<?> message) -> {

            log.info("MQTT接收消息: {}", message);

            MqttUsrHeaders mqttUsrHeaders = getMqttUsrHeaders(message);

            String payload = (String) message.getPayload();

            switch (mqttUsrHeaders.topic()) {
                case UPDATE_TOPIC:
                    try {
                        DeviceUpReport deviceUpReport = objectMapper.readValue(payload, DeviceUpReport.class);
                        MqttUsrPayload event = new MqttUsrPayload(deviceUpReport);

                        applicationEventPublisher.publishEvent(new MqttUsrUpdateMessage(mqttUsrHeaders, event));

                    } catch (JsonProcessingException e) {
                        log.error("MQTT接收消息解析失败 payload:{}", payload, e);
                    }
                    applicationEventPublisher.publishEvent(new MqttUsrHeartMessage(mqttUsrHeaders, payload));
                    return;
                case WILL_TOPIC:
                    applicationEventPublisher.publishEvent(new MqttUsrWillMessage(mqttUsrHeaders, payload));
                    return;
                case HEART_TOPIC:
                    applicationEventPublisher.publishEvent(new MqttUsrHeartMessage(mqttUsrHeaders, payload));
                    return;
            }
        };
    }

    private static MqttUsrHeaders getMqttUsrHeaders(Message<?> message) {
        String topic = message.getHeaders().get("mqtt_receivedTopic", String.class);
        Integer qos = message.getHeaders().get("mqtt_receivedQos", Integer.class);
        Long timestamp = message.getHeaders().get("timestamp", Long.class);
//        UUID id = message.getHeaders().get("id", UUID.class);
        return new MqttUsrHeaders("id.toString()", topic, qos, timestamp);
    }



}
