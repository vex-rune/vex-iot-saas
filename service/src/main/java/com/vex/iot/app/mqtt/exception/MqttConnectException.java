package com.vex.iot.app.mqtt.exception;

/**
 * MQTT连接失败异常
 */
public class MqttConnectException extends com.vex.iot.common.exception.BizException {
    public static final String CODE = "mqtt_connect_failed";

    public MqttConnectException(String msg) {
        super(CODE, msg);
    }
}
