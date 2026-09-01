package com.vex.iot.api.http;

import com.vex.iot.domain.notify.NotifyService;
import com.vex.iot.common.queries.QueriesPageRequest;
import com.vex.iot.common.response.Response;
import com.vex.iot.domain.audit.annotation.AuditLog;
import com.vex.iot.domain.notify.model.NotifyTemplateEntity;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * 通知模版
 */
@RestController
@RequiredArgsConstructor
public class NotifyTemplateApi {

    private final NotifyService notifyService;

    /**
     * 条件查询
     */
    @PostMapping("/api/notify-templates/query")
    public Response<List<NotifyTemplateEntity>> query(@Valid @RequestBody QueriesPageRequest req) {
        return Response.ok(notifyService.templateQuery(req));
    }

    /**
     * 数量查询
     */
    @PostMapping("/api/notify-templates/count")
    public Response<Long> count(@Valid @RequestBody QueriesPageRequest req) {
        return Response.ok(notifyService.templateCount(req));
    }

    /**
     * 保存
     */
    @AuditLog(action = "NOTIFY_TEMPLATE_SAVE", resourceType = "notify_template")
    @PostMapping("/api/notify-templates")
    public Response<NotifyTemplateEntity> save(@Valid @RequestBody NotifyTemplateEntity entity) {
        return Response.ok(notifyService.saveTemplate(entity));
    }

    /**
     * 删除(软删)
     */
    @AuditLog(action = "NOTIFY_TEMPLATE_DELETE", resourceType = "notify_template")
    @DeleteMapping("/api/notify-templates/{id}")
    public Response<Void> delete(@PathVariable String id) {
        notifyService.deleteTemplate(id);
        return Response.ok();
    }
}
