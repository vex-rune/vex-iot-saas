package com.vex.iot.app.mqtt.usr;

public record MqttUsrHeaders(String id, String topic, Integer qos, Long timestamp) {
}
