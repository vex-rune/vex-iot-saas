package com.vex.iot.common.util;

import com.vex.iot.common.model.CurrentUser;

import java.util.Optional;
import java.util.function.Supplier;

/**
 * 当前用户上下文:仅在 HTTP 请求主线程(由 JwtAuthenticationFilter 注入)内有效。
 *
 * <p>所有 getter 强制返回 Optional,业务侧必须显式处理"无上下文"分支,严禁裸 getXxx() 取 null。
 * 异步任务(线程池)不会自动继承 ThreadLocal,需要从事件源(triggerUser)显式传入。
 */
public final class UserContext {
    private static final ThreadLocal<CurrentUser> CURRENT = new ThreadLocal<>();

    private UserContext() {
    }

    public static void set(CurrentUser user) {
        CURRENT.set(user);
    }

    /**
     * 当前线程的 CurrentUser; 上下文中无值时返回 Optional.empty(),绝不返回 null。
     */
    public static Optional<CurrentUser> current() {
        return Optional.ofNullable(CURRENT.get());
    }

    public static void clear() {
        CURRENT.remove();
    }

    public static Optional<String> tenantId() {
        return current().map(CurrentUser::tenantId);
    }

    public static Optional<String> username() {
        return current().map(CurrentUser::username);
    }

    public static Optional<String> userId() {
        return current().map(CurrentUser::userId);
    }

    /**
     * 不推荐使用: 仅在 Controller/Filter 强校验场景用一次。
     */
    public static CurrentUser require() {
        return current().orElseThrow(() -> new IllegalStateException("缺少用户上下文"));
    }

    /**
     * 在线程内执行 work, 期间 UserContext 可见 user; 退出时恢复原状态(若原本就有)。
     */
    public static <T> T runWith(CurrentUser user, Supplier<T> work) {
        if (user == null) throw new IllegalArgumentException("user 不能为空");
        CurrentUser prev = CURRENT.get();
        try {
            CURRENT.set(user);
            return work.get();
        } finally {
            if (prev == null) CURRENT.remove();
            else CURRENT.set(prev);
        }
    }

    public static void runWith(CurrentUser user, Runnable work) {
        runWith(user, () -> {
            work.run();
            return null;
        });
    }
}
