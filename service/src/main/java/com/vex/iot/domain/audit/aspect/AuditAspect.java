package com.vex.iot.domain.audit.aspect;

import com.vex.iot.domain.audit.annotation.AuditLog;
import com.vex.iot.common.enums.OperationAction;
import com.vex.iot.common.enums.OperationResult;
import com.vex.iot.common.enums.ResourceType;
import com.vex.iot.common.model.CurrentUser;
import com.vex.iot.common.util.UserContext;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.aspectj.lang.ProceedingJoinPoint;
import org.aspectj.lang.annotation.Aspect;
import org.springframework.stereotype.Component;

/// 审计切面
/// 在 Controller 方法执行前后记录日志。
/// 由于 writer.saveOperation 是 @Async (线程池内执行)，必须在切面中读取 UserContext 并显式传入 CurrentUser。
@Slf4j
@Aspect
@Component
@RequiredArgsConstructor
public class AuditAspect {

    /// 审计日志写入器
    private final AuditWriter writer;

    /// 环绕通知：拦截带 @AuditLog 注解的方法
    /// @param pjp 切入点
    /// @param audit 审计日志注解
    /// @return 方法执行结果
    /// @throws Throwable 执行异常
//    @Around("@annotation(audit)")
    public Object around(ProceedingJoinPoint pjp, AuditLog audit) throws Throwable {
        String arg = pjp.getArgs() == null || pjp.getArgs().length == 0
                ? null : String.valueOf(pjp.getArgs()[0]);
        CurrentUser cu = UserContext.current().orElse(null);
        try {
            Object result = pjp.proceed();
            writer.saveOperation(cu,
                    OperationAction.valueOf(audit.action()),
                    ResourceType.valueOf(audit.resourceType()),
                    arg,
                    OperationResult.SUCCESS,
                    null);
            return result;
        } catch (Throwable ex) {
            writer.saveOperation(cu,
                    OperationAction.valueOf(audit.action()),
                    ResourceType.valueOf(audit.resourceType()),
                    arg,
                    OperationResult.FAIL,
                    ex.getMessage());
            throw ex;
        }
    }
}
