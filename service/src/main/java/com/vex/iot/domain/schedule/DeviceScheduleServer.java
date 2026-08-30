package com.vex.iot.domain.schedule;

import com.vex.iot.app.http.model.DeviceScheduleDetail;
import com.vex.iot.app.http.model.DeviceScheduleRequest;
import com.vex.iot.common.exception.BusinessExceptions.BadRequestException;
import com.vex.iot.common.model.BaseEntity;
import com.vex.iot.common.util.IdGenerator;
import com.vex.iot.common.util.UserContext;
import com.vex.iot.domain.schedule.exception.DeviceScheduleNotFoundException;
import com.vex.iot.domain.schedule.model.DeviceScheduleActionEntity;
import com.vex.iot.domain.schedule.model.DeviceScheduleEntity;
import com.vex.iot.domain.schedule.repository.DeviceScheduleActionRepository;
import com.vex.iot.domain.schedule.repository.DeviceScheduleRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.support.CronExpression;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

/**
 * 设备定时控制服务
 * <p>仅负责 CRUD，任务调度由 {@link DeviceScheduleScheduler} 接管。
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class DeviceScheduleServer {

    private final DeviceScheduleRepository scheduleRepository;
    private final DeviceScheduleActionRepository actionRepository;
    private final DeviceScheduleScheduler scheduler;

    public List<DeviceScheduleDetail> listByDevice(String deviceId) {
        return scheduleRepository.findByDeviceId(deviceId).stream()
                .map(this::toDetail)
                .toList();
    }

    public DeviceScheduleDetail get(String id) {
        return toDetail(loadOrThrow(id));
    }

    @Transactional
    public DeviceScheduleDetail save(DeviceScheduleRequest req) {
        DeviceScheduleEntity incoming = req.schedule();
        validate(incoming);
        LocalDateTime now = LocalDateTime.now();
        String operator = UserContext.username().orElse(BaseEntity.SYSTEM_USER_ID);
        String ruleId;
        if (incoming.getId() == null || incoming.getId().isBlank()) {
            ruleId = IdGenerator.snowId();
            incoming.setId(ruleId);
            if (incoming.getTenantId() == null || incoming.getTenantId().isBlank()) {
                incoming.setTenantId(BaseEntity.DEFAULT_TENANT_ID);
            }
            incoming.stampCreated(operator, now);
        } else {
            ruleId = incoming.getId();
            DeviceScheduleEntity existed = loadOrThrow(ruleId);
            if (!existed.getDeviceId().equals(incoming.getDeviceId())) {
                throw new BadRequestException("不允许修改规则所属设备");
            }
            incoming.stampUpdated(operator, now);
            incoming.setCreateId(existed.getCreateId());
            incoming.setCreatedAt(existed.getCreatedAt());
            incoming.setTenantId(existed.getTenantId());
        }
        DeviceScheduleEntity saved = scheduleRepository.save(incoming);
        // 动作整体覆盖
        actionRepository.deleteByScheduleId(saved.getId());
        for (int i = 0; i < req.actions().size(); i++) {
            DeviceScheduleActionEntity a = req.actions().get(i);
            if (a.getId() == null || a.getId().isBlank()) a.setId(IdGenerator.snowId());
            a.setScheduleId(saved.getId());
            a.setSortOrder(a.getSortOrder() != null ? a.getSortOrder() : i);
            actionRepository.save(a);
        }
        log.info("保存定时规则完成 scheduleId={} enabled={}", saved.getId(), saved.getEnabled());

        // 立即刷新该规则的任务队列
        scheduler.refreshTasks(ruleId);

        return toDetail(saved);
    }

    @Transactional
    public void delete(String id) {
        loadOrThrow(id);
        scheduleRepository.deleteById(id);
        actionRepository.deleteByScheduleId(id);
        log.info("删除定时规则 scheduleId={}", id);

        // 刷新任务队列（会移除该规则的任务）
        scheduler.refreshTasks(null);
    }

    @Transactional
    public void setEnabled(String id, boolean enabled) {
        DeviceScheduleEntity entity = loadOrThrow(id);
        entity.setEnabled(enabled);
        entity.setUpdatedAt(LocalDateTime.now());
        scheduleRepository.save(entity);
        log.info("设置定时规则启用状态 scheduleId={} enabled={}", id, enabled);

        // 刷新该规则的任务队列
        scheduler.refreshTasks(id);
    }

    // ── 私有 ─────────────────────────────────────────────────────────

    private DeviceScheduleEntity loadOrThrow(String id) {
        return scheduleRepository.findById(id)
                .orElseThrow(() -> new DeviceScheduleNotFoundException(id));
    }

    private DeviceScheduleDetail toDetail(DeviceScheduleEntity s) {
        return new DeviceScheduleDetail(s, actionRepository.findByScheduleIdOrderBySortOrderAsc(s.getId()));
    }

    private void validate(DeviceScheduleEntity s) {
        if (s.getDeviceId() == null || s.getDeviceId().isBlank()) {
            throw new BadRequestException("设备ID不能为空");
        }
        if (s.getCron() == null || s.getCron().isBlank()) {
            throw new BadRequestException("Cron 表达式不能为空");
        }
        try {
            CronExpression.parse(s.getCron());
        } catch (Exception ex) {
            throw new BadRequestException("Cron 表达式不合法: " + ex.getMessage());
        }
    }
}
