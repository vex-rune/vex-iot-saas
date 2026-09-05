package com.vex.iot.app.auth.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * bootstrap 一次性初始化配置:从 application.yml 中读取 token。
 */
@ConfigurationProperties(prefix = "vex.bootstrap")
public record BootstrapProperties(String token, String defaultTenantId) {
}
