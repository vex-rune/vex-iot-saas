package com.vex.iot.api.http;

import com.vex.iot.domain.notify.NotifyService;
import com.vex.iot.common.queries.QueriesPageRequest;
import com.vex.iot.common.response.Response;
import com.vex.iot.domain.notify.model.NotifyRecordEntity;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * 通知记录(只读)
 */
@RestController
@RequiredArgsConstructor
public class NotifyRecordApi {

    private final NotifyService notifyService;

    /**
     * 条件查询
     */
    @PostMapping("/api/notify-records/query")
    public Response<List<NotifyRecordEntity>> query(@Valid @RequestBody QueriesPageRequest req) {
        return Response.ok(notifyService.recordQuery(req));
    }

    /**
     * 数量查询
     */
    @PostMapping("/api/notify-records/count")
    public Response<Long> count(@Valid @RequestBody QueriesPageRequest req) {
        return Response.ok(notifyService.recordCount(req));
    }
}
