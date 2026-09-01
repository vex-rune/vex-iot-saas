package com.vex.iot.app.mqtt.usr;

public record MqttUsrWillMessage(MqttUsrHeaders mqttUsrHeaders, String gatewayId) {
}
