package com.vex.iot.app.http.sse;

import com.vex.iot.common.exception.BusinessExceptions.BadRequestException;
import com.vex.iot.common.util.UserContext;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.util.UUID;

/**
 * SSE实时推送
 */
@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
public class SseController {

    private final SsePusher ssePusher;

    /**
     * 建立SSE连接
     *
     * @return SSE事件发射器
     */
    @GetMapping("/sse/stream")
    public SseEmitter stream() {
        String tenantId = UserContext.tenantId().orElseThrow(() -> new BadRequestException("未登录"));
        return ssePusher.register(tenantId, UUID.randomUUID().toString());
    }
}
