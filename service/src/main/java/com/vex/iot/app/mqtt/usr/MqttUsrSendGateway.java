package com.vex.iot.app.mqtt.usr;

import org.springframework.integration.annotation.MessagingGateway;
import org.springframework.messaging.handler.annotation.Header;

/**
 * 发送网关，业务层直接注入调用 sendToMqtt
 */
@MessagingGateway(defaultRequestChannel = "mqttOutboundChannel")
public interface MqttUsrSendGateway {

    /**
     * 重载：指定topic发送
     */
    void sendToMqtt(@Header("mqtt_topic") String topic, String payload);
}
