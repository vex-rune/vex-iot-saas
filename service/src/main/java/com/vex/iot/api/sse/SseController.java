package com.vex.iot.api.sse;

import com.vex.iot.common.exception.BadRequestException;
import com.vex.iot.common.util.UserContext;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.util.UUID;

/**
 * SSE实时推送
 */
@RestController
@RequiredArgsConstructor
public class SseController {

    private final SsePusher ssePusher;

    /**
     * 建立SSE连接
     *
     * @return SSE事件发射器
     */
    @GetMapping("/api/sse/stream")
    public SseEmitter stream() {
        String tenantId = UserContext.tenantId().orElseThrow(() -> new BadRequestException("未登录"));
        return ssePusher.register(tenantId, UUID.randomUUID().toString());
    }
}
