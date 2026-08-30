package com.vex.iot.app.http;

import com.vex.iot.domain.audit.annotation.AuditLog;
import com.vex.iot.common.queries.QueriesPageRequest;
import jakarta.validation.Valid;
import com.vex.iot.common.response.Response;
import com.vex.iot.domain.notify.model.NotifyUserEntity;
import com.vex.iot.domain.notify.NotifyServer;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * 通知用户
 */
@RestController
@RequestMapping("/api/notify-users")
@RequiredArgsConstructor
public class NotifyUserController {

    /**
     * 通知服务
     */
    private final NotifyServer notifyServer;

    /**
     * 通知用户-条件查询
     *
     * @param req 查询条件
     * @return 通知用户列表
     */
    @PostMapping("/query")
    public Response<List<NotifyUserEntity>> query(@Valid @RequestBody QueriesPageRequest req) {
        return Response.ok(notifyServer.query(req));
    }

    /**
     * 通知用户-数量查询
     *
     * @param req 查询条件
     * @return 通知用户数量
     */
    @PostMapping("/count")
    public Response<Long> count(@Valid @RequestBody QueriesPageRequest req) {
        return Response.ok(notifyServer.count(req));
    }

    /**
     * 通知用户-保存
     *
     * @param user 通知用户
     * @return 保存后的通知用户
     */
    @AuditLog(action = "NOTIFY_USER_SAVE", resourceType = "notify_user")
    @PostMapping
    public Response<NotifyUserEntity> save(@Valid @RequestBody NotifyUserEntity user) {
        return Response.ok(notifyServer.save(user));
    }

    /**
     * 通知用户-删除
     *
     * @param id 通知用户ID
     * @return 操作结果
     */
    @AuditLog(action = "NOTIFY_USER_DELETE", resourceType = "notify_user")
    @DeleteMapping("/{id}")
    public Response<Void> delete(@PathVariable String id) {
        notifyServer.delete(id);
        return Response.ok();
    }
}
