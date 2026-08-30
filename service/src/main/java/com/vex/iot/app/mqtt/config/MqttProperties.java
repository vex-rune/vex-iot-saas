package com.vex.iot.app.mqtt.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * MQTT配置属性
 *
 * <p>对应 application.yml 的 mqtt.* 配置。
 */
@ConfigurationProperties(prefix = "mqtt")
public record MqttProperties(
        /**
         * 客户端ID前缀
         */
        String clientIdPrefix,

        /**
         * Broker地址
         */
        String brokerUrl,

        /**
         * 用户名
         */
        String username,

        /**
         * 密码
         */
        String password,

        /**
         * 默认QoS
         */
        int defaultQos,

        /**
         * 共享订阅组
         */
        String shareGroup,

        /**
         * 上行主题模式
         */
        String upTopicPattern,

        /**
         * 下行主题模式
         */
        String downTopicPattern
) {
}
