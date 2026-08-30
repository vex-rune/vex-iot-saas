package com.vex.iot.app.http;

import com.vex.iot.common.queries.QueriesPageRequest;
import com.vex.iot.common.response.Response;
import com.vex.iot.domain.notify.model.NotifyRecordEntity;
import com.vex.iot.domain.notify.NotifyRecordServer;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * 通知记录(只读)
 */
@RestController
@RequestMapping("/api/notify-records")
@RequiredArgsConstructor
public class NotifyRecordController {

    private final NotifyRecordServer server;

    /**
     * 条件查询
     */
    @PostMapping("/query")
    public Response<List<NotifyRecordEntity>> query(@Valid @RequestBody QueriesPageRequest req) {
        return Response.ok(server.query(req));
    }

    /**
     * 数量查询
     */
    @PostMapping("/count")
    public Response<Long> count(@Valid @RequestBody QueriesPageRequest req) {
        return Response.ok(server.count(req));
    }
}
