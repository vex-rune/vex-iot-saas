package com.vex.iot.domain.alarm.suppress;

import com.vex.iot.domain.alarm.model.AlarmRuleEntity;
import com.vex.iot.domain.alarm.repository.AlarmLogRepository;
import com.vex.iot.domain.device.model.DataEntity;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;

/// 告警抑制策略单元测试
@ExtendWith(MockitoExtension.class)
@DisplayName("告警抑制策略测试")
class AlarmSuppressStrategyTest {

    @Mock
    private AlarmLogRepository eventRepo;

    private AlarmRuleEntity rule;
    private DataEntity data;

    @BeforeEach
    void setUp() {
        rule = AlarmRuleEntity.builder()
                .id("rule-001")
                .deviceId("device-001")
                .pointCode("temp")
                .build();

        data = DataEntity.builder()
                .deviceId("device-001")
                .pointCode("temp")
                .stringValue("35.5")
                .timestamp(Instant.now())
                .build();
    }

}