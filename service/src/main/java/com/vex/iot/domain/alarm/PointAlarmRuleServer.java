package com.vex.iot.domain.alarm;

import com.vex.iot.domain.alarm.exception.PointAlarmRuleNotFoundException;
import com.vex.iot.domain.alarm.model.PointAlarmRuleEntity;
import com.vex.iot.domain.alarm.repository.PointAlarmRuleRepository;
import com.vex.iot.common.model.BaseEntity;
import com.vex.iot.common.util.UserContext;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.time.LocalDateTime;
import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class PointAlarmRuleServer {

    private final PointAlarmRuleRepository repository;

    public List<PointAlarmRuleEntity> listByPointDefinition(String pointDefinitionId) {
        return repository.findByPointDefinitionId(pointDefinitionId);
    }

    public List<PointAlarmRuleEntity> listEnabledByPointDefinition(String pointDefinitionId) {
        return repository.findByPointDefinitionIdAndEnabledTrue(pointDefinitionId);
    }

    public PointAlarmRuleEntity get(String id) {
        return repository.findById(id).orElseThrow(() -> new PointAlarmRuleNotFoundException(id));
    }

    public PointAlarmRuleEntity save(PointAlarmRuleEntity rule) {
        LocalDateTime now = LocalDateTime.now();
        String operator = UserContext.username().orElse(BaseEntity.SYSTEM_USER_ID);
        if (rule.getId() == null || rule.getId().isBlank()) {
            rule.setId(null);
            if (rule.getTenantId() == null || rule.getTenantId().isBlank()) {
                rule.setTenantId(BaseEntity.DEFAULT_TENANT_ID);
            }
            rule.stampCreated(operator, now);
        } else {
            rule.stampUpdated(operator, now);
        }
        return repository.save(rule);
    }

    public void delete(String id) {
        repository.deleteById(id);
    }

    /// 检查规则是否处于屏蔽状态（未屏蔽 或 屏蔽已过期）
    public boolean isMasked(PointAlarmRuleEntity rule) {
        if (rule.getMaskEnable() == null || !rule.getMaskEnable()) {
            return false;
        }
        if (rule.getMaskExpireTime() == null) {
            return true; // 永久屏蔽
        }
        return Instant.now().isBefore(rule.getMaskExpireTime());
    }
}
