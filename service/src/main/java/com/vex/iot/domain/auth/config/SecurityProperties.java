package com.vex.iot.domain.auth.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "jwt")
public record SecurityProperties(String secret, long expireSeconds, String header, String prefix) {
}