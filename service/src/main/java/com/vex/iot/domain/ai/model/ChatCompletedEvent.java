package com.vex.iot.domain.ai.model;

public record ChatCompletedEvent(
        String userId,
        String tenantId,
        String resourceType,
        String action
) {
}
