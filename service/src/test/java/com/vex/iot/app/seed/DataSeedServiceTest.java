package com.vex.iot.app.seed;

import com.vex.iot.domain.alarm.repository.AlarmLogRepository;
import com.vex.iot.domain.alarm.repository.AlarmRuleRepository;
import com.vex.iot.domain.device.DataService;
import com.vex.iot.domain.device.repository.ControlRecordRepository;
import com.vex.iot.domain.device.repository.DevicePanelRepository;
import com.vex.iot.domain.device.repository.DeviceRepository;
import com.vex.iot.domain.device.repository.PointDefinitionRepository;
import com.vex.iot.domain.identity.repository.AccountRepository;
import com.vex.iot.domain.identity.repository.SysTenantAccountRepository;
import com.vex.iot.domain.identity.repository.TenantRepository;
import com.vex.iot.domain.notify.repository.NotifyRecordRepository;
import com.vex.iot.domain.notify.repository.NotifyTemplateRepository;
import com.vex.iot.domain.notify.repository.NotifyUserRepository;
import com.vex.iot.domain.schedule.repository.DeviceScheduleRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;

/// 数据播种开关逻辑单元测试（不依赖数据库）
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
@DisplayName("数据播种开关测试")
class DataSeedServiceTest {

    @Mock
    private DeviceRepository deviceRepository;
    @Mock
    private PointDefinitionRepository pointDefinitionRepository;
    @Mock
    private DataService dataService;
    @Mock
    private TenantRepository tenantRepository;
    @Mock
    private AccountRepository accountRepository;
    @Mock
    private SysTenantAccountRepository sysTenantAccountRepository;
    @Mock
    private NotifyUserRepository notifyUserRepository;
    @Mock
    private NotifyTemplateRepository notifyTemplateRepository;
    @Mock
    private NotifyRecordRepository notifyRecordRepository;
    @Mock
    private AlarmRuleRepository alarmRuleRepository;
    @Mock
    private AlarmLogRepository alarmLogRepository;
    @Mock
    private ControlRecordRepository controlRecordRepository;
    @Mock
    private DevicePanelRepository devicePanelRepository;
    @Mock
    private DeviceScheduleRepository deviceScheduleRepository;

    @InjectMocks
    private DataSeedService dataSeedService;

    @Test
    @DisplayName("库中已有设备且 force=false 时跳过播种")
    void skipWhenDeviceExists() {
        when(deviceRepository.count()).thenReturn(10L);

        DataSeedProperties props = new DataSeedProperties();
        props.setEnabled(true);

        assertThat(dataSeedService.seedFullSystemData(props)).isNull();
        verify(tenantRepository, never()).save(org.mockito.ArgumentMatchers.any());
    }

    @Test
    @DisplayName("force=true 时即使已有设备也执行播种")
    void seedWhenForced() {
        when(deviceRepository.count()).thenReturn(10L);
        // 保存动作返回 null 会在后续步骤 NPE，这里只验证「不再走跳过分支」
        when(tenantRepository.findById(org.mockito.ArgumentMatchers.anyString()))
                .thenThrow(new IllegalStateException("已进入播种流程"));

        DataSeedProperties props = new DataSeedProperties();
        props.setEnabled(true);
        props.setForce(true);

        try {
            dataSeedService.seedFullSystemData(props);
        } catch (IllegalStateException e) {
            assertThat(e).hasMessage("已进入播种流程");
            return;
        }
        // 未抛出说明未进入播种流程
        assertThat(false).as("force=true 时应进入播种流程").isTrue();
    }

    @Test
    @DisplayName("默认配置：开关关闭、非强制、10 设备 30 天")
    void defaultProperties() {
        DataSeedProperties props = new DataSeedProperties();

        assertThat(props.isEnabled()).isFalse();
        assertThat(props.isForce()).isFalse();
        assertThat(props.getDeviceCount()).isEqualTo(10);
        assertThat(props.getHistoryDays()).isEqualTo(30);
        assertThat(props.getPassword()).isEqualTo("12345678");
    }
}
