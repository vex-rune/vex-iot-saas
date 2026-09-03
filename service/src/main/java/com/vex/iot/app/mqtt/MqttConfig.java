package com.vex.iot.app.mqtt;

import lombok.extern.slf4j.Slf4j;
import org.eclipse.paho.client.mqttv3.MqttConnectOptions;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.integration.annotation.ServiceActivator;
import org.springframework.integration.channel.DirectChannel;
import org.springframework.integration.mqtt.core.DefaultMqttPahoClientFactory;
import org.springframework.integration.mqtt.core.MqttPahoClientFactory;
import org.springframework.integration.mqtt.inbound.MqttPahoMessageDrivenChannelAdapter;
import org.springframework.integration.mqtt.outbound.MqttPahoMessageHandler;
import org.springframework.integration.mqtt.support.DefaultPahoMessageConverter;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.MessageHandler;

import java.util.UUID;

import static com.vex.iot.app.mqtt.MqttConnectProperties.*;

/**
 * Spring Integration MQTT 完整配置：发布 + 订阅一体
 * doc: https://docs.spring.io/spring-integration/reference/mqtt.html
 */
@Slf4j
@Configuration
public class MqttConfig {

    public static final String MQTT_OUTBOUND_CHANNEL = "mqttOutboundChannel";
    public static final String MQTT_OUTBOUND_HANDLER = "mqttOutboundHandler";
    public static final String MQTT_INBOUND_CHANNEL = "mqttInboundChannel";
    public static final String MQTT_INBOUND_ADAPTER = "mqttInboundAdapter";

    @Bean
    public MqttPahoClientFactory mqttClientFactory(MqttConnectProperties mqttConnectProperties) {
        DefaultMqttPahoClientFactory factory = new DefaultMqttPahoClientFactory();
        MqttConnectOptions options = new MqttConnectOptions();

        options.setServerURIs(new String[]{mqttConnectProperties.connection().broker()});
        options.setUserName(mqttConnectProperties.connection().username());
        options.setPassword(mqttConnectProperties.connection().password().toCharArray());

        options.setCleanSession(true);
        options.setConnectionTimeout(10);
        options.setKeepAliveInterval(60);
        options.setAutomaticReconnect(true);  // 启用自动重连

        factory.setConnectionOptions(options);
        return factory;
    }

    /**
     * 出站消息通道：Gateway发送消息进入此通道
     */
    @Bean(MQTT_OUTBOUND_CHANNEL)
    public MessageChannel mqttOutboundChannel() {
        return new DirectChannel();
    }

    /**
     * 出站处理器：负责向MQTT Broker发布消息
     */
    @Bean(MQTT_OUTBOUND_HANDLER)
    @ServiceActivator(inputChannel = "mqttOutboundChannel")
    public MessageHandler mqttOutboundHandler(MqttPahoClientFactory mqttClientFactory) {
        // outbound clientId，不要和inbound重复
        String clientId = "mqtt-out-" + UUID.randomUUID();
        MqttPahoMessageHandler handler = new MqttPahoMessageHandler(clientId, mqttClientFactory);
        handler.setAsync(true);
        handler.setDefaultTopic("testTopic");
        handler.setDefaultQos(1);
        return handler;
    }

    /**
     * 订阅接收消息通道：Broker推送过来的消息进入该通道
     */
    @Bean(MQTT_INBOUND_CHANNEL)
    public MessageChannel mqttInboundChannel() {
        return new DirectChannel();
    }

    /**
     * MQTT入站适配器：真正执行订阅
     * topics：需要订阅的topic数组，支持通配符 device/# , +
     */
    @Bean(MQTT_INBOUND_ADAPTER)
    public MqttPahoMessageDrivenChannelAdapter mqttInboundAdapter(MqttPahoClientFactory mqttClientFactory) {
        String clientId = "mqtt-in-" + UUID.randomUUID();
        // 在这里配置你要订阅的topic列表
        String[] subscribeTopics = {
                // 更新
                UPDATE_TOPIC,
                // 离线
                WILL_TOPIC,
                // 心跳
                HEART_TOPIC
        };

        MqttPahoMessageDrivenChannelAdapter adapter =
                new MqttPahoMessageDrivenChannelAdapter(clientId, mqttClientFactory, subscribeTopics);

        adapter.setCompletionTimeout(5000);
        adapter.setConverter(new DefaultPahoMessageConverter());
        adapter.setQos(1);
        // 收到消息输出到 inboundChannel
        adapter.setOutputChannel(mqttInboundChannel());
        return adapter;
    }
}
