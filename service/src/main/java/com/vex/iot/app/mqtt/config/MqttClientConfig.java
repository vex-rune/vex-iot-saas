package com.vex.iot.app.mqtt.config;

import lombok.extern.slf4j.Slf4j;
import org.eclipse.paho.client.mqttv3.MqttConnectOptions;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.integration.annotation.MessagingGateway;
import org.springframework.integration.channel.DirectChannel;
import org.springframework.integration.core.MessageProducer;
import org.springframework.integration.mqtt.core.DefaultMqttPahoClientFactory;
import org.springframework.integration.mqtt.core.MqttPahoClientFactory;
import org.springframework.integration.mqtt.inbound.MqttPahoMessageDrivenChannelAdapter;
import org.springframework.integration.mqtt.outbound.MqttPahoMessageHandler;
import org.springframework.integration.mqtt.support.DefaultPahoMessageConverter;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.MessageHandler;
import org.springframework.messaging.handler.annotation.Header;

import java.util.UUID;

/**
 * MQTT客户端配置
 *
 * <p>Spring Integration MQTT 配置：
 * <ul>
 *   <li>MqttPahoClientFactory 管理连接 (自动重连由 Paho 内置)</li>
 *   <li>上行: 两个独立入站适配器分别订阅共享主题</li>
 *   <li>下行: 通过 MqttDownstreamGateway 发布到指定主题</li>
 * </ul>
 */
@Slf4j
@Configuration
@org.springframework.boot.context.properties.EnableConfigurationProperties(MqttProperties.class)
public class MqttClientConfig {

    /**
     * 客户端ID前缀
     */
    private static final String CLIENT_ID_PREFIX = "si-";

    // ─── 连接工厂 ───

    /**
     * MQTT客户端工厂
     *
     * @param props MQTT配置属性
     * @return MQTT客户端工厂
     */
    @Bean
    public MqttPahoClientFactory mqttClientFactory(MqttProperties props) {
        DefaultMqttPahoClientFactory factory = new DefaultMqttPahoClientFactory();
        MqttConnectOptions opt = new MqttConnectOptions();
        opt.setServerURIs(new String[]{props.brokerUrl()});
        opt.setUserName(props.username());
        opt.setPassword(props.password().toCharArray());
        opt.setCleanSession(true);
        opt.setAutomaticReconnect(true);
        opt.setKeepAliveInterval(30);
        opt.setConnectionTimeout(10);
        factory.setConnectionOptions(opt);
        return factory;
    }

    // ─── 共享订阅主题生成器 ───

    /**
     * MQTT主题构建器
     *
     * @param props MQTT配置属性
     * @return MQTT主题构建器
     */
    @Bean
    public MqttTopicBuilder mqttTopicBuilder(MqttProperties props) {
        return new MqttTopicBuilder(props);
    }

    // ─── 上行入站适配器: 设备数据 (共享订阅) ───

    /**
     * 上行消息通道
     *
     * @return 上行消息通道
     */
    @Bean
    public MessageChannel mqttUpstreamInputChannel() {
        return new DirectChannel();
    }

    /**
     * 上行消息入站适配器
     *
     * @param factory     客户端工厂
     * @param props       配置属性
     * @param topicBuilder 主题构建器
     * @return 消息生产者
     */
    @Bean
    public MessageProducer mqttUpstreamInbound(MqttPahoClientFactory factory,
                                               MqttProperties props,
                                               MqttTopicBuilder topicBuilder) {
        String clientId = CLIENT_ID_PREFIX + "up-" + UUID.randomUUID().toString().substring(0, 8);
        MqttPahoMessageDrivenChannelAdapter adapter =
                new MqttPahoMessageDrivenChannelAdapter(
                        clientId, factory, topicBuilder.sharedUpTopic());
        DefaultPahoMessageConverter converter = new DefaultPahoMessageConverter();
        converter.setPayloadAsBytes(true);
        adapter.setConverter(converter);
        adapter.setQos(props.defaultQos());
        adapter.setOutputChannel(mqttUpstreamInputChannel());
        log.info("上行入站适配器已创建 topic={} clientId={}", topicBuilder.sharedUpTopic(), clientId);
        return adapter;
    }

    // ─── 上行入站适配器: 心跳 (共享订阅, 独立客户端) ───

    /**
     * 心跳消息通道
     *
     * @return 心跳消息通道
     */
    @Bean
    public MessageChannel mqttHeartbeatInputChannel() {
        return new DirectChannel();
    }

    /**
     * 心跳消息入站适配器
     *
     * @param factory     客户端工厂
     * @param props       配置属性
     * @param topicBuilder 主题构建器
     * @return 消息生产者
     */
    @Bean
    public MessageProducer mqttHeartbeatInbound(MqttPahoClientFactory factory,
                                                MqttProperties props,
                                                MqttTopicBuilder topicBuilder) {
        String clientId = CLIENT_ID_PREFIX + "hb-" + UUID.randomUUID().toString().substring(0, 8);
        MqttPahoMessageDrivenChannelAdapter adapter =
                new MqttPahoMessageDrivenChannelAdapter(
                        clientId, factory, topicBuilder.sharedHeartbeatTopic());
        DefaultPahoMessageConverter converter = new DefaultPahoMessageConverter();
        converter.setPayloadAsBytes(true);
        adapter.setConverter(converter);
        adapter.setQos(props.defaultQos());
        adapter.setOutputChannel(mqttHeartbeatInputChannel());
        log.info("心跳入站适配器已创建 topic={} clientId={}", topicBuilder.sharedHeartbeatTopic(), clientId);
        return adapter;
    }

    // ─── 下行出站: 按设备动态路由主题 ───

    /**
     * 下行消息通道
     *
     * @return 下行消息通道
     */
    @Bean
    public MessageChannel mqttDownstreamOut() {
        return new DirectChannel();
    }

    /**
     * 下行消息出站处理器
     *
     * @param factory 客户端工厂
     * @return 消息处理器
     */
    @Bean
    @org.springframework.integration.annotation.ServiceActivator(inputChannel = "mqttDownstreamOut")
    public MessageHandler mqttOutbound(MqttPahoClientFactory factory) {
        String clientId = CLIENT_ID_PREFIX + "down-" + UUID.randomUUID().toString().substring(0, 8);
        MqttPahoMessageHandler handler = new MqttPahoMessageHandler(clientId, factory);
        handler.setAsync(true);
        handler.setDefaultTopic("device/placeholder");
        log.info("下行出站处理器已创建 clientId={}", clientId);
        return handler;
    }

    // ─── 下行发布网关 ───

    /**
     * MQTT下行发布网关
     */
    @MessagingGateway(defaultRequestChannel = "mqttDownstreamOut")
    public interface MqttDownstreamGateway {
        /**
         * 发送消息到指定主题
         *
         * @param topic   主题
         * @param payload 消息内容
         */
        void send(@Header("mqtt_topic") String topic, byte[] payload);
    }

    // ─── 工具类:共享订阅主题 ───

    /**
     * MQTT主题构建器
     */
    public static class MqttTopicBuilder {
        private final MqttProperties props;

        /**
         * 构造函数
         *
         * @param props MQTT配置属性
         */
        public MqttTopicBuilder(MqttProperties props) {
            this.props = props;
        }

        /**
         * 获取上行共享订阅主题
         *
         * @return 上行共享订阅主题
         */
        public String sharedUpTopic() {
            String up = props.upTopicPattern() == null ? "+/update" : props.upTopicPattern();
            return "$share/" + props.shareGroup() + "/" + up;
        }

        /**
         * 获取心跳共享订阅主题
         *
         * @return 心跳共享订阅主题
         */
        public String sharedHeartbeatTopic() {
            return "$share/" + props.shareGroup() + "/+/heartbeat";
        }

        /**
         * 构建下行主题
         *
         * @param deviceCode 设备编码
         * @return 下行主题
         */
        public String downTopic(String deviceCode) {
            if (deviceCode == null || deviceCode.isBlank()) {
                throw new com.vex.iot.common.exception.BusinessExceptions.BadRequestException("deviceCode 不能为空");
            }
            return props.downTopicPattern().replace("${deviceCode}", deviceCode);
        }
    }
}
