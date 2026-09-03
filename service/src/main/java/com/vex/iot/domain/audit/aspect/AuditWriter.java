package com.vex.iot.domain.audit.aspect;

import com.vex.iot.common.enums.OperationAction;
import com.vex.iot.common.enums.OperationResult;
import com.vex.iot.common.enums.ResourceType;
import com.vex.iot.common.model.CurrentUser;
import com.vex.iot.common.util.UserContext;
import com.vex.iot.domain.audit.model.ControlLogEntity;
import com.vex.iot.domain.audit.model.OperationLogEntity;
import com.vex.iot.domain.audit.repo.ControlLogRepository;
import com.vex.iot.domain.audit.repo.OperationLogRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

/**
 * 审计日志写入器
 *
 * <p>@Async 在线程池内执行，ThreadLocal 不可见。
 * 必须由调用方显式传入 CurrentUser，严禁在异步方法里读取 UserContext。
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class AuditWriter {

    /**
     * 操作日志仓储
     */
    private final OperationLogRepository operationRepo;

    /**
     * 控制日志仓储
     */
    private final ControlLogRepository controlRepo;

    /**
     * 异步保存操作日志
     *
     * @param operator     操作人
     * @param action       操作类型
     * @param resourceType 资源类型
     * @param arg          参数
     * @param status       状态
     * @param errMsg       错误信息
     */
//    @Async
    public void saveOperation(CurrentUser operator, OperationAction action, ResourceType resourceType,
                              String arg, OperationResult status, String errMsg) {
        try {
            String tenantId = operator == null ? null : operator.tenantId();
            String username = operator == null ? null : operator.username();
            operationRepo.save(OperationLogEntity.builder()
                    .id(UUID.randomUUID().toString().replace("-", ""))
                    .tenantId(tenantId)
                    .username(username)
                    .action(action)
                    .resourceType(resourceType)
                    .detail(arg)
                    .status(status)
                    .errorMessage(errMsg)
                    .occurredAt(Instant.now())
                    .build());
        } catch (Exception ex) {
            log.warn("审计落库失败 action={}", action, ex);
        }
    }

    /**
     * 同步保存操作日志
     *
     * <p>从 UserContext 抓取调用者上下文，同步落库。仅在希望审计立即可见时使用。
     *
     * @param action       操作类型
     * @param resourceType 资源类型
     * @param arg          参数
     * @param status       状态
     * @param errMsg       错误信息
     */
    public void saveOperationSync(OperationAction action, ResourceType resourceType, String arg, OperationResult status, String errMsg) {
        Optional<CurrentUser> cu = UserContext.current();
        try {
            String tenantId = cu.map(CurrentUser::tenantId).orElse(null);
            String username = cu.map(CurrentUser::username).orElse(null);
            operationRepo.save(OperationLogEntity.builder()
                    .id(UUID.randomUUID().toString().replace("-", ""))
                    .tenantId(tenantId).username(username)
                    .action(action).resourceType(resourceType).detail(arg)
                    .status(status).errorMessage(errMsg)
                    .occurredAt(Instant.now()).build());
        } catch (Exception ex) {
            log.warn("审计落库失败 action={}", action, ex);
        }
    }

    /**
     * 异步保存控制日志
     *
     * @param record 控制日志记录
     */
//    @Async
    public void saveControl(ControlLogEntity record) {
        try {
            controlRepo.save(record);
        } catch (Exception ex) {
            log.warn("控制日志落库失败 deviceId={}", record.getDeviceId(), ex);
        }
    }
}
