package com.vex.iot.app.auth.util;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * TOTP 动态码配置
 *
 * <p>生产部署必须通过环境变量 TOTP_SECRET 注入至少 16 字节的密钥。
 */
@ConfigurationProperties(prefix = "vex.auth.admin.totp")
public record TotpProperties(String secret) {
}