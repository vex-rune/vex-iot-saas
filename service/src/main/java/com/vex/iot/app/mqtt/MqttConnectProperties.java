package com.vex.iot.app.mqtt;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "vex.mqtt")
public record MqttConnectProperties(MqttConnection connection) {


    public static final String SET_TOPIC = "/setting";
    public static final String UPDATE_TOPIC = "/update";
    public static final String WILL_TOPIC = "/will";
    public static final String HEART_TOPIC = "/hearts";

    public record MqttConnection(
            String broker,
            String username,
            String password
    ) {
    }

}
