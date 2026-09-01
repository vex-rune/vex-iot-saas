package com.vex.iot.app.mqtt.usr;

public record MqttUsrHeartMessage(MqttUsrHeaders mqttUsrHeaders, String payload) {
}
