package com.vex.iot.api.http;

import com.vex.iot.common.queries.QueriesPageRequest;
import com.vex.iot.common.response.Response;
import com.vex.iot.domain.notify.NotifyService;
import com.vex.iot.domain.notify.model.NotifyTemplateEntity;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

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
        req.withTenantFilter();
        return Response.ok(notifyService.templateQuery(req));
    }

    /**
     * 数量查询
     */
    @PostMapping("/api/notify-templates/count")
    public Response<Long> count(@Valid @RequestBody QueriesPageRequest req) {
        req.withTenantFilter();
        return Response.ok(notifyService.templateCount(req));
    }

    /**
     * 保存
     */
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','ADMIN')")
    @PostMapping("/api/notify-templates")
    public Response<NotifyTemplateEntity> save(@Valid @RequestBody NotifyTemplateEntity entity) {
        return Response.ok(notifyService.saveTemplate(entity));
    }

    /**
     * 删除(软删)
     */
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','ADMIN')")
    @DeleteMapping("/api/notify-templates/{id}")
    public Response<Void> delete(@PathVariable String id) {
        notifyService.deleteTemplate(id);
        return Response.ok();
    }
}
