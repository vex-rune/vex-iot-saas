package com.vex.iot.domain.auth.model;

import lombok.Builder;

import java.util.Set;

@Builder
public record LoginUser(
        String userId,
        String username,
        String tenantId,
        Set<String> roles,
        Set<String> permissions
) {
}