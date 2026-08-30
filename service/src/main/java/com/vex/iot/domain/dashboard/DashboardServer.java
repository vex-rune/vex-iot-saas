package com.vex.iot.domain.dashboard;

import com.vex.iot.common.enums.BizType;
import com.vex.iot.common.model.BaseEntity;
import com.vex.iot.common.util.UserContext;
import com.vex.iot.domain.dashboard.exception.DashboardNotFoundException;
import com.vex.iot.domain.dashboard.model.DashboardCardEntity;
import com.vex.iot.domain.dashboard.model.DashboardDefinitionEntity;
import com.vex.iot.domain.dashboard.repository.DashboardCardRepository;
import com.vex.iot.domain.dashboard.repository.DashboardDefinitionRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class DashboardServer {

    private final DashboardDefinitionRepository definitionRepository;
    private final DashboardCardRepository cardRepository;

    // ==================== Dashboard Definition ====================

    public List<DashboardDefinitionEntity> listByBizType(BizType bizType) {
        return definitionRepository.findByBizTypeAndEnabledTrueOrderBySortOrderAsc(bizType);
    }

    public List<DashboardDefinitionEntity> listByDevice(String deviceId, BizType bizType) {
        return definitionRepository.findByDeviceIdAndBizTypeAndEnabledTrueOrderBySortOrderAsc(deviceId, bizType);
    }

    public DashboardDefinitionEntity getDefaultDashboard(String deviceId, BizType bizType) {
        return definitionRepository.findByDeviceIdAndBizTypeAndIsDefaultTrueAndEnabledTrue(deviceId, bizType)
                .orElse(null);
    }

    public DashboardDefinitionEntity get(String id) {
        return definitionRepository.findById(id).orElseThrow(() -> new DashboardNotFoundException(id));
    }

    public DashboardDefinitionEntity save(DashboardDefinitionEntity dashboard) {
        LocalDateTime now = LocalDateTime.now();
        String operator = UserContext.username().orElse(BaseEntity.SYSTEM_USER_ID);
        if (dashboard.getId() == null || dashboard.getId().isBlank()) {
            dashboard.setId(null);
            if (dashboard.getTenantId() == null || dashboard.getTenantId().isBlank()) {
                dashboard.setTenantId(BaseEntity.DEFAULT_TENANT_ID);
            }
            dashboard.stampCreated(operator, now);
        } else {
            dashboard.stampUpdated(operator, now);
        }
        return definitionRepository.save(dashboard);
    }

    public void delete(String id) {
        // 先删除关联的卡片，再删定义（避免外键约束异常）
        List<DashboardCardEntity> cards = cardRepository.findByDashboardIdAndEnabledTrueOrderBySortOrderAsc(id);
        for (DashboardCardEntity card : cards) {
            cardRepository.deleteById(card.getId());
        }
        definitionRepository.deleteById(id);
    }

    // ==================== Dashboard Card ====================

    public List<DashboardCardEntity> listCards(String dashboardId) {
        return cardRepository.findByDashboardIdAndEnabledTrueOrderBySortOrderAsc(dashboardId);
    }

    public DashboardCardEntity getCard(String id) {
        return cardRepository.findById(id).orElse(null);
    }

    public DashboardCardEntity saveCard(DashboardCardEntity card) {
        LocalDateTime now = LocalDateTime.now();
        String operator = UserContext.username().orElse(BaseEntity.SYSTEM_USER_ID);
        if (card.getId() == null || card.getId().isBlank()) {
            card.setId(null);
            if (card.getTenantId() == null || card.getTenantId().isBlank()) {
                card.setTenantId(BaseEntity.DEFAULT_TENANT_ID);
            }
            card.stampCreated(operator, now);
        } else {
            card.stampUpdated(operator, now);
        }
        return cardRepository.save(card);
    }

    public void deleteCard(String id) {
        cardRepository.deleteById(id);
    }
}
