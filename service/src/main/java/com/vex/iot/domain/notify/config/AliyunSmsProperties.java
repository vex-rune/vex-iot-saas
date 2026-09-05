package com.vex.iot.domain.notify.config;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

/**
 * 阿里云短信配置。
 * 由 service 模块通过 application.yml 注入,domain 只负责接收。
 */
@Getter
@Setter
@Component
@ConfigurationProperties(prefix = "vex.aliyun.sms")
public class AliyunSmsProperties {

    /**
     * 显式开关;false 时 SmsChannel 不会被创建,系统降级到 LogChannel。
     */
    private boolean enabled;

    private String accessKeyId;
    private String accessKeySecret;
    private String signName;
    private String templateCode;
    private String endpoint;
}