package com.vex.iot.app.mqtt.exception;

/**
 * MQTT消息发布失败异常
 */
public class MqttPublishException extends com.vex.iot.common.exception.BizException {
    public static final String CODE = "mqtt_publish_failed";

    public MqttPublishException(String msg) {
        super(CODE, msg);
    }

    public MqttPublishException(String msg, Throwable cause) {
        super(CODE, msg, cause);
    }
}
