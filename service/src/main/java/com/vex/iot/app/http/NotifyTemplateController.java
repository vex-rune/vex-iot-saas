package com.vex.iot.app.http;

import com.vex.iot.common.queries.QueriesPageRequest;
import com.vex.iot.common.response.Response;
import com.vex.iot.domain.audit.annotation.AuditLog;
import com.vex.iot.domain.notify.model.NotifyTemplateEntity;
import com.vex.iot.domain.notify.NotifyTemplateServer;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * 通知模版
 */
@RestController
@RequestMapping("/api/notify-templates")
@RequiredArgsConstructor
public class NotifyTemplateController {

    private final NotifyTemplateServer server;

    /**
     * 条件查询
     */
    @PostMapping("/query")
    public Response<List<NotifyTemplateEntity>> query(@Valid @RequestBody QueriesPageRequest req) {
        return Response.ok(server.query(req));
    }

    /**
     * 数量查询
     */
    @PostMapping("/count")
    public Response<Long> count(@Valid @RequestBody QueriesPageRequest req) {
        return Response.ok(server.count(req));
    }

    /**
     * 保存
     */
    @AuditLog(action = "NOTIFY_TEMPLATE_SAVE", resourceType = "notify_template")
    @PostMapping
    public Response<NotifyTemplateEntity> save(@Valid @RequestBody NotifyTemplateEntity entity) {
        return Response.ok(server.save(entity));
    }

    /**
     * 删除(软删)
     */
    @AuditLog(action = "NOTIFY_TEMPLATE_DELETE", resourceType = "notify_template")
    @DeleteMapping("/{id}")
    public Response<Void> delete(@PathVariable String id) {
        server.delete(id);
        return Response.ok();
    }
}
