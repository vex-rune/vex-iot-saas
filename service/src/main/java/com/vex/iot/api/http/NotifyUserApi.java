package com.vex.iot.api.http;

import com.vex.iot.common.queries.QueriesPageRequest;
import com.vex.iot.common.response.Response;
import com.vex.iot.domain.notify.NotifyService;
import com.vex.iot.domain.notify.model.NotifyUserEntity;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * 通知用户
 */
@RestController
@RequiredArgsConstructor
public class NotifyUserApi {

    /**
     * 通知服务
     */
    private final NotifyService notifyService;

    /**
     * 通知用户-条件查询
     *
     * @param req 查询条件
     * @return 通知用户列表
     */
    @PostMapping("/api/notify-users/query")
    public Response<List<NotifyUserEntity>> query(@Valid @RequestBody QueriesPageRequest req) {
        req.withTenantFilter();
        return Response.ok(notifyService.userQuery(req));
    }

    /**
     * 通知用户-数量查询
     *
     * @param req 查询条件
     * @return 通知用户数量
     */
    @PostMapping("/api/notify-users/count")
    public Response<Long> count(@Valid @RequestBody QueriesPageRequest req) {
        req.withTenantFilter();
        return Response.ok(notifyService.userCount(req));
    }

    /**
     * 通知用户-保存
     *
     * @param user 通知用户
     * @return 保存后的通知用户
     */
    @PostMapping("/api/notify-users")
    public Response<NotifyUserEntity> save(@Valid @RequestBody NotifyUserEntity user) {
        return Response.ok(notifyService.saveUser(user));
    }

    /**
     * 通知用户-删除
     *
     * @param id 通知用户ID
     * @return 操作结果
     */
    @DeleteMapping("/api/notify-users/{id}")
    public Response<Void> delete(@PathVariable String id) {
        notifyService.deleteUser(id);
        return Response.ok();
    }
}
