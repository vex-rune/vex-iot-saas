package com.vex.iot.app.auth.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "vex.auth.jwt")
public record SecurityProperties(String secret, long expireSeconds, String header, String prefix) {
}
