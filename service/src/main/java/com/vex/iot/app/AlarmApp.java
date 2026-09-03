package com.vex.iot.app;

import com.vex.iot.common.model.CurrentUser;
import com.vex.iot.domain.alarm.AlarmService;
import com.vex.iot.domain.alarm.model.AlarmRuleEntity;
import com.vex.iot.domain.data.event.DataUpdateEvent;
import com.vex.iot.domain.data.model.DataEntity;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.lang3.math.NumberUtils;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.context.event.EventListener;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.util.List;

/**
 * 报警引擎服务。
 * <p>
 * 异步监听设备点位实时数据，根据报警规则进行评估，
 * 当点位值满足报警条件时触发报警事件，数值恢复正常时自动恢复报警。
 * </p>
 *
 * @author Vex
 * @since 1.0
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class AlarmApp {

    private static final String SYSTEM_OPERATOR = "SYSTEM";
    private static final String JS_ENGINE_NAME = "javascript";

    private final AlarmService alarmService;
    private final ApplicationEventPublisher eventPublisher;

    /**
     * 获取触发者用户名。
     * 如果触发用户为空，返回系统用户名。
     */
    private String getOperator(CurrentUser triggerUser) {
        if (triggerUser != null) {
            return triggerUser.username();
        }
        return SYSTEM_OPERATOR;
    }

    /**
     * 异步订阅采集器发布的实时数据事件。
     */
    @Async
    @EventListener(DataUpdateEvent.class)
    public void onAlarm(DataUpdateEvent snap) {

        DataEntity data = snap.data();

        // 获得规则
        List<AlarmRuleEntity> rules = alarmService.listEnabledRulesByPoint(data.getPointId());
        if (rules.isEmpty()) {
            return;
        }

        // 判断规则

        for (AlarmRuleEntity rule : rules) {
            evaluateSingleRule(data, rule);
        }

        // 是命中
        // eventPublisher.publishEvent(AlarmTriggeredEvent.
    }


    /**
     * 评估单条报警规则。
     */
    private void evaluateSingleRule(DataEntity data, AlarmRuleEntity rule) {
        // 获取点位原始值
        String rawValue = data.getStringValue();
        if (rawValue == null) {
            return;
        }

        List<String> notifyUserIds = rule.getNotifyUserIds();

        if (notifyUserIds != null && !notifyUserIds.isEmpty()) {
            return;
        }


        // 数字对比
        boolean isAbnormal = false;
        if (NumberUtils.isCreatable(rawValue)) {
            // 转换为数值
            BigDecimal numericValue = alarmService.convertToNumeric(rawValue);
            // 判断是否异常
            isAbnormal = alarmService.checkAbnormal(rule, numericValue);
        }


        if (!isAbnormal) {
            alarmService.publishAlarm(rule, rawValue, data);
        } else {
            alarmService.recoverAlarm(rule);
        }

    }

}
