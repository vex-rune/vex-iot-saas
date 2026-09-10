package com.vex.iot.app.seed;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.vex.iot.common.constants.RoleConstants;
import com.vex.iot.common.model.TenantBaseEntity;
import com.vex.iot.common.security.PasswordHasher;
import com.vex.iot.domain.ai.model.AiChatMemoryEntity;
import com.vex.iot.domain.ai.model.AiUserProfileEntity;
import com.vex.iot.domain.ai.repository.AiChatMemoryRepository;
import com.vex.iot.domain.ai.repository.AiUserProfileRepository;
import com.vex.iot.domain.alarm.enums.AlarmAckStatus;
import com.vex.iot.domain.alarm.enums.AlarmConditionType;
import com.vex.iot.domain.alarm.enums.AlarmLevel;
import com.vex.iot.domain.alarm.enums.EventStatus;
import com.vex.iot.domain.alarm.model.AlarmLogEntity;
import com.vex.iot.domain.alarm.model.AlarmRuleEntity;
import com.vex.iot.domain.alarm.repository.AlarmLogRepository;
import com.vex.iot.domain.alarm.repository.AlarmRuleRepository;
import com.vex.iot.domain.alarm.suppress.AlarmSuppressType;
import com.vex.iot.domain.device.DataService;
import com.vex.iot.domain.device.enums.*;
import com.vex.iot.domain.device.model.*;
import com.vex.iot.domain.device.repository.*;
import com.vex.iot.domain.identity.model.AccountEntity;
import com.vex.iot.domain.identity.model.SysTenantAccountEntity;
import com.vex.iot.domain.identity.model.TenantEntity;
import com.vex.iot.domain.identity.repository.AccountRepository;
import com.vex.iot.domain.identity.repository.SysTenantAccountRepository;
import com.vex.iot.domain.identity.repository.TenantRepository;
import com.vex.iot.domain.notify.enums.NotifyChannelType;
import com.vex.iot.domain.notify.enums.NotifyRecordStatus;
import com.vex.iot.domain.notify.enums.NotifyTemplatePlatform;
import com.vex.iot.domain.notify.enums.NotifyTemplateType;
import com.vex.iot.domain.notify.model.NotifyRecordEntity;
import com.vex.iot.domain.notify.model.NotifyTemplateEntity;
import com.vex.iot.domain.notify.model.NotifyUserEntity;
import com.vex.iot.domain.notify.repository.NotifyRecordRepository;
import com.vex.iot.domain.notify.repository.NotifyTemplateRepository;
import com.vex.iot.domain.notify.repository.NotifyUserRepository;
import com.vex.iot.domain.report.definition.ReportDefinitionRepository;
import com.vex.iot.domain.report.model.*;
import com.vex.iot.domain.schedule.model.DeviceScheduleEntity;
import com.vex.iot.domain.schedule.model.ScheduleAction;
import com.vex.iot.domain.schedule.repository.DeviceScheduleRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.*;

/**
 * 全系统演示数据播种服务 — 向数据库写入完整的演示数据。
 *
 * <p>覆盖范围（按依赖顺序）：租户 → 账号 → 租户账号中间表 → 通知用户/模板 →
 * 设备/点位 → 告警规则 → 控制记录 → 定时规则 → 设备面板 → 告警事件 →
 * 通知记录 → 历史数据 → 设备模版 → 报表定义 → AI用户画像 → AI对话记忆。
 *
 * <p>租户 / 账号 / 设备 / 点位 / 面板 / 设备模版 / 报表定义 / AI画像为幂等写入；
 * 告警规则、控制记录、定时规则、通知记录、历史数据、AI记忆为追加写入，
 * 因此默认仅在库中无设备时执行一次
 * （见 {@link DataSeedProperties#isForce()}）。
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class DataSeedService {

    /**
     * 设备最大数量 — 受内置车间/产线标签表限制
     */
    private static final int MAX_DEVICE_COUNT = 10;
    private static final long MIN_INTERVAL_MINUTES = 1;
    private static final long MAX_INTERVAL_MINUTES = 120;
    private static final Random random = new Random();

    private final DeviceRepository deviceRepository;
    private final PointDefinitionRepository pointDefinitionRepository;
    private final DataService dataService;

    private final TenantRepository tenantRepository;
    private final AccountRepository accountRepository;
    private final SysTenantAccountRepository sysTenantAccountRepository;

    private final NotifyUserRepository notifyUserRepository;
    private final NotifyTemplateRepository notifyTemplateRepository;
    private final NotifyRecordRepository notifyRecordRepository;

    private final AlarmRuleRepository alarmRuleRepository;
    private final AlarmLogRepository alarmLogRepository;

    private final ControlRecordRepository controlRecordRepository;
    private final DevicePanelRepository devicePanelRepository;
    private final DeviceScheduleRepository deviceScheduleRepository;
    private final DeviceTemplateRepository deviceTemplateRepository;

    private final AiUserProfileRepository aiUserProfileRepository;
    private final AiChatMemoryRepository aiChatMemoryRepository;

    private final ReportDefinitionRepository reportDefinitionRepository;

    private final ObjectMapper objectMapper;

    /**
     * 执行全系统数据播种。
     *
     * @param props 播种参数（设备数量、历史天数、统一密码、是否强制）
     * @return 播种结果；当库中已有设备且 {@code force=false} 时返回 {@code null} 表示已跳过
     */
    public SeedResult seedFullSystemData(DataSeedProperties props) {
        if (!props.isEnabled()) {
            log.info("[数据播种] 播种开关未开启，跳过播种");
            return null;
        }
        if (!props.isForce() && deviceRepository.count() > 0) {
            return null;
        }

        int deviceCount = Math.min(Math.max(props.getDeviceCount(), 0), MAX_DEVICE_COUNT);
        int historyDays = Math.max(props.getHistoryDays(), 0);
        String password = props.getPassword();

        log.info("[数据播种] 开始播种: 设备={} 历史={}天", deviceCount, historyDays);

        // 1. 租户
        Map<String, TenantEntity> tenants = seedTenants();
        TenantEntity demoTenant = tenants.get("demo");
        TenantEntity prodTenant = tenants.get("prod");

        // 2. 账号
        Map<String, AccountEntity> accounts = seedAccounts(password);

        // 3. 中间表
        seedTenantAccountLinks(accounts, demoTenant, prodTenant);

        // 4. 通知用户 / 模板
        Map<String, NotifyUserEntity> notifyUsers = seedNotifyUsers(demoTenant, prodTenant);
        List<NotifyTemplateEntity> templates = seedNotifyTemplates(demoTenant, prodTenant);

        // 5. 设备 / 点位
        List<DeviceEntity> devices = seedDevices(demoTenant, prodTenant, deviceCount);
        List<PointEntity> allPoints = new ArrayList<>();
        for (int i = 0; i < devices.size(); i++) {
            DeviceEntity device = devices.get(i);
            allPoints.addAll(createPointsForDevice(device.getId(), device.getDeviceName(), device.getTenantId(), i));
        }

        // 6. 告警规则
        List<AlarmRuleEntity> alarmRules = seedAlarmRules(devices, allPoints,
                new ArrayList<>(notifyUsers.values()));

        // 7. 控制记录
        List<ControlRecordEntity> controlRecords = accounts.isEmpty()
                ? new ArrayList<>()
                : seedControlRecords(devices, allPoints, accounts.values().iterator().next());

        // 8. 定时规则
        List<DeviceScheduleEntity> schedules = seedSchedules(devices, allPoints);

        // 9. 设备面板
        List<DevicePanelEntity> panels = seedDevicePanels(devices, allPoints);

        // 10. 告警事件
        List<AlarmLogEntity> alarmLogs = seedAlarmLogs(alarmRules);

        // 11. 通知记录
        List<NotifyRecordEntity> notifyRecords = seedNotifyRecords(notifyUsers, alarmLogs);

        // 12. 历史数据
        List<DataEntity> allHistoryData = seedHistoryData(devices, allPoints, historyDays);

        // 13. 设备模版
        List<DeviceTemplateEntity> deviceTemplates = seedDeviceTemplates(devices);

        // 14. 报表定义
        List<ReportDefinitionEntity> reportDefinitions = seedReportDefinitions(demoTenant, prodTenant);

        // 15. AI 用户画像
        List<AiUserProfileEntity> aiProfiles = seedAiUserProfiles(accounts, demoTenant, prodTenant);

        // 16. AI 对话记忆
        List<AiChatMemoryEntity> aiMemories = seedAiChatMemories(accounts, demoTenant);

        log.info("[数据播种] 完成: 租户={} 账号={} 通知人={} 模板={} 设备={} 点位={} "
                        + "告警规则={} 告警事件={} 控制记录={} 定时规则={} 面板={} 通知记录={} "
                        + "历史数据={} 设备模版={} 报表定义={} AI画像={} AI记忆={}",
                tenants.size(), accounts.size(), notifyUsers.size(), templates.size(),
                devices.size(), allPoints.size(), alarmRules.size(), alarmLogs.size(),
                controlRecords.size(), schedules.size(), panels.size(), notifyRecords.size(),
                allHistoryData.size(), deviceTemplates.size(), reportDefinitions.size(),
                aiProfiles.size(), aiMemories.size());

        return new SeedResult(tenants, accounts, notifyUsers, templates, devices, allPoints,
                alarmRules, alarmLogs, controlRecords, schedules, panels, notifyRecords, allHistoryData,
                deviceTemplates, reportDefinitions, aiProfiles, aiMemories);
    }

    // ==================== 1. 租户 ====================
    private Map<String, TenantEntity> seedTenants() {
        Map<String, TenantEntity> result = new LinkedHashMap<>();

        TenantEntity defaultTenant = tenantRepository.findById(TenantBaseEntity.DEFAULT_TENANT_ID).orElse(null);
        if (defaultTenant == null) {
            defaultTenant = TenantEntity.builder()
                    .id(TenantBaseEntity.DEFAULT_TENANT_ID)
                    .code("default")
                    .name("系统默认租户")
                    .description("系统级默认租户，所有未明确归属的数据归属于此")
                    .enabled(true)
                    .build();
            defaultTenant.stampCreated(TenantBaseEntity.SYSTEM_USER_ID, Instant.now());
            defaultTenant = tenantRepository.save(defaultTenant);
        }
        result.put("default", defaultTenant);

        TenantEntity demoTenant = tenantRepository.findByCode("demo").orElse(null);
        if (demoTenant == null) {
            demoTenant = TenantEntity.builder()
                    .code("demo")
                    .name("演示租户")
                    .description("用于功能演示的演示租户")
                    .enabled(true)
                    .build();
            demoTenant.stampCreated(TenantBaseEntity.SYSTEM_USER_ID, Instant.now());
            demoTenant = tenantRepository.save(demoTenant);
        }
        result.put("demo", demoTenant);

        TenantEntity prodTenant = tenantRepository.findByCode("prod").orElse(null);
        if (prodTenant == null) {
            prodTenant = TenantEntity.builder()
                    .code("prod")
                    .name("生产租户")
                    .description("正式生产环境租户")
                    .enabled(true)
                    .build();
            prodTenant.stampCreated(TenantBaseEntity.SYSTEM_USER_ID, Instant.now());
            prodTenant = tenantRepository.save(prodTenant);
        }
        result.put("prod", prodTenant);

        log.info("[数据播种] 租户: default({}), demo({}), prod({})",
                defaultTenant.getId(), demoTenant.getId(), prodTenant.getId());
        return result;
    }

    // ==================== 2. 账号 ====================
    private Map<String, AccountEntity> seedAccounts(String password) {
        Map<String, AccountEntity> result = new LinkedHashMap<>();

        // (username, displayName, roles[])
        Object[][] specs = {
                {"admin", "系统超管", new String[]{RoleConstants.SUPER_ADMIN}},
                {"demo_admin", "演示租户管理员", new String[]{RoleConstants.ADMIN}},
                {"prod_admin", "生产租户管理员", new String[]{RoleConstants.ADMIN}},
                {"operator1", "操作员1", new String[]{RoleConstants.OPERATOR}},
                {"operator2", "操作员2", new String[]{RoleConstants.OPERATOR}},
                {"guest", "访客用户", new String[]{RoleConstants.GUEST}}
        };

        for (Object[] spec : specs) {
            String username = (String) spec[0];
            Set<String> roles = new HashSet<>(List.of((String[]) spec[2]));

            AccountEntity exist = accountRepository.findByUsername(username).orElse(null);
            if (exist != null) {
                result.put(username, exist);
                continue;
            }

            String salt = PasswordHasher.generateSalt();
            AccountEntity acc = AccountEntity.builder()
                    .username(username)
                    .displayName((String) spec[1])
                    .passwordHash(PasswordHasher.hash(salt, password))
                    .salt(salt)
                    .roles(roles)
                    .enabled(true)
                    .lastLoginAt(Instant.now().minus(random.nextInt(7) + 1, ChronoUnit.DAYS))
                    .build();
            acc.stampCreated(TenantBaseEntity.SYSTEM_USER_ID, Instant.now());
            result.put(username, accountRepository.save(acc));
        }
        log.info("[数据播种] 账号: {} 个（统一密码: {}）", result.size(), password);
        return result;
    }

    // ==================== 3. 中间表 ====================
    private void seedTenantAccountLinks(Map<String, AccountEntity> accounts,
                                        TenantEntity demo, TenantEntity prod) {
        // (username, tenantId)
        Object[][] links = {
                {"demo_admin", demo.getId()},
                {"prod_admin", prod.getId()},
                {"operator1", demo.getId()},
                {"operator2", prod.getId()},
                {"guest", demo.getId()}
        };

        int created = 0;
        for (Object[] link : links) {
            AccountEntity acc = accounts.get((String) link[0]);
            String tenantId = (String) link[1];
            if (acc == null) continue;

            if (!sysTenantAccountRepository.existsByTenantIdAndUserId(tenantId, acc.getId())) {
                SysTenantAccountEntity row = new SysTenantAccountEntity();
                row.setTenantId(tenantId);
                row.setUserId(acc.getId());
                row.setEnabled(true);
                row.stampCreated(TenantBaseEntity.SYSTEM_USER_ID, Instant.now());
                sysTenantAccountRepository.save(row);
                created++;
            }
        }
        log.info("[数据播种] 租户账号关联: 新建 {} 行", created);
    }

    // ==================== 4. 通知用户 / 模板 ====================
    private Map<String, NotifyUserEntity> seedNotifyUsers(TenantEntity demo, TenantEntity prod) {
        Map<String, NotifyUserEntity> result = new LinkedHashMap<>();

        // name, phone, department, sms, wechat, enabled, tenantCode
        Object[][] specs = {
                {"张三", "13800000001", "运维部", true, true, true, "demo"},
                {"李四", "13800000002", "运维部", true, false, true, "demo"},
                {"王五", "13800000003", "生产部", true, true, true, "demo"},
                {"赵六", "13800000004", "生产部", true, false, true, "prod"},
                {"钱七", "13800000005", "安环部", true, true, true, "demo"},
                {"孙八", "13800000006", "设备部", false, true, true, "demo"},
                {"周九", "13800000007", "质量部", true, true, true, "prod"},
                {"吴十", "13800000008", "能源部", true, false, true, "prod"},
                {"郑工", "13800000009", "动力车间", true, true, true, "demo"},
                {"冯主管", "13800000010", "生产管理", true, true, true, "prod"}
        };

        for (Object[] spec : specs) {
            String name = (String) spec[0];
            NotifyUserEntity user = NotifyUserEntity.builder()
                    .tenantId("demo".equals(spec[6]) ? demo.getId() : prod.getId())
                    .name(name)
                    .phone((String) spec[1])
                    .department((String) spec[2])
                    .smsEnabled((boolean) spec[3])
                    .wechatEnabled((boolean) spec[4])
                    .enabled((boolean) spec[5])
                    .build();
            user.stampCreated(TenantBaseEntity.SYSTEM_USER_ID, Instant.now());
            result.put(name, notifyUserRepository.save(user));
        }
        log.info("[数据播种] 通知用户: {} 个", result.size());
        return result;
    }

    private List<NotifyTemplateEntity> seedNotifyTemplates(TenantEntity demo, TenantEntity prod) {
        List<NotifyTemplateEntity> result = new ArrayList<>();

        // name, type, platform, templateId, contentExample, tenantCode
        Object[][] specs = {
                {"报警短信-阿里云", NotifyTemplateType.SMS, NotifyTemplatePlatform.ALIYUN,
                        "SMS_001", "【IoT平台】设备${deviceName}触发${alarmLevel}报警：${message}", "demo"}
        };

        for (Object[] spec : specs) {
            NotifyTemplateEntity tpl = NotifyTemplateEntity.builder()
                    .tenantId("demo".equals(spec[5]) ? demo.getId() : prod.getId())
                    .name((String) spec[0])
                    .type((NotifyTemplateType) spec[1])
                    .platform((NotifyTemplatePlatform) spec[2])
                    .templateId((String) spec[3])
                    .contentExample((String) spec[4])
                    .enabled(true)
                    .build();
            tpl.stampCreated(TenantBaseEntity.SYSTEM_USER_ID, Instant.now());
            result.add(notifyTemplateRepository.save(tpl));
        }
        log.info("[数据播种] 通知模板: {} 个", result.size());
        return result;
    }

    // ==================== 5. 设备 / 点位 ====================
    private List<DeviceEntity> seedDevices(TenantEntity demo, TenantEntity prod, int deviceCount) {
        List<DeviceEntity> devices = new ArrayList<>();

        // 真实设备名称列表 — 覆盖多种工业场景
        String[][] deviceSpecs = {
                // {设备名称, 网关类型, 车间, 产线, 工位, 租户}
                {"CNC数控铣床-A01", "USR_G771_EDGE", "精密加工车间", "产线1", "工位1", "demo"},
                {"永磁同步电机-M01", "USR_G771_EDGE", "动力车间", "产线1", "工位1", "demo"},
                {"循环水泵-P01", "USR_G771_EDGE", "流体车间", "产线1", "工位1", "demo"},
                {"智能电表-E01", "USR_G771_EDGE", "配电间", "产线1", "工位1", "demo"},
                {"注塑温控箱-T01", "USR_G771_EDGE", "注塑车间", "产线1", "工位1", "demo"},
                {"自动包装线-L01", "USR_G771_EDGE", "包装车间", "产线1", "工位1", "prod"},
                {"环境监测站-S01", "USR_G771_EDGE", "环保监测", "产线1", "工位1", "prod"},
                {"天然气管道-V01", "USR_G771_EDGE", "燃气站", "产线1", "工位1", "prod"},
                {"螺杆空压机-C01", "USR_G771_EDGE", "动力车间", "产线1", "工位1", "prod"},
                {"燃气锅炉-B01", "USR_G771_EDGE", "锅炉房", "产线1", "工位1", "prod"},
        };

        for (int i = 1; i <= deviceCount; i++) {
            String deviceId = "DEV_" + String.format("%03d", i);

            // 幂等检查
            DeviceEntity existingDevice = deviceRepository.findById(deviceId).orElse(null);
            if (existingDevice != null) {
                devices.add(existingDevice);
                continue;
            }

            int specIndex = (i - 1) % deviceSpecs.length;
            String[] spec = deviceSpecs[specIndex];
            String deviceName = spec[0];
            GatewayType gwType = GatewayType.USR_G771_EDGE;
            String tenantName = spec[5];
            String tenantId = "demo".equals(tenantName) ? demo.getId() : prod.getId();

            DeviceOnline online = random.nextDouble() < 0.8 ? DeviceOnline.ONLINE : DeviceOnline.OFFLINE;
            DeviceEntity device = DeviceEntity.builder()
                    .id(deviceId)
                    .tenantId(tenantId)
                    .deviceName(deviceName)
                    .gatewayId("GW_" + String.format("%03d", (i - 1) / 5 + 1))
                    .gatewayType(gwType.name())
                    .enabled(true)
                    .online(online)
                    .level1Tag(spec[2])
                    .level2Tag(spec[3])
                    .level3Tag(spec[4])
                    .lastHeartbeatAt(online == DeviceOnline.ONLINE
                            ? Instant.now().minus(random.nextInt(60), ChronoUnit.SECONDS)
                            : Instant.now().minus(random.nextInt(24) + 1, ChronoUnit.HOURS))
                    .build();
            device.stampCreated(TenantBaseEntity.SYSTEM_USER_ID, Instant.now());
            devices.add(deviceRepository.save(device));
        }
        log.info("[数据播种] 设备: {} 个", devices.size());
        return devices;
    }

    /**
     * 为设备创建点位 — 根据设备索引分配不同的点位组合，确保多样性。
     * 确定性 ID 保证幂等。
     */
    private List<PointEntity> createPointsForDevice(String deviceId, String deviceName, String tenantId, int deviceIndex) {
        List<PointEntity> points = new ArrayList<>();
        List<Object[]> pointSpecs = buildPointSpecs(deviceName, deviceIndex);

        for (Object[] spec : pointSpecs) {
            int sortOrder = (int) spec[0];
            String suffix = (String) spec[1];
            String pointCode = (String) spec[2];
            String pName = (String) spec[3];
            String desc = (String) spec[4];
            String unit = (String) spec[5];
            DataType dataType = (DataType) spec[6];
            AccessType access = (AccessType) spec[7];
            int precision = (int) spec[8];
            String valueMappings = (String) spec[10];
            String groupLabel = (String) spec[11];

            String pointId = "PT_" + deviceId + "_" + suffix;
            PointEntity existing = pointDefinitionRepository.findById(pointId).orElse(null);
            if (existing != null) {
                points.add(existing);
                continue;
            }

            PointEntity.PointEntityBuilder<?, ?> builder = PointEntity.builder()
                    .id(pointId)
                    .tenantId(tenantId)
                    .deviceId(deviceId)
                    .pointCode(pointCode)
                    .pointName(pName)
                    .description(desc)
                    .unit(unit)
                    .dataType(dataType)
                    .access(access)
                    .sortOrder(sortOrder)
                    .precision(precision);

            if (valueMappings != null) {
                builder.valueMappings(valueMappings);
            }
            if (groupLabel != null) {
                builder.groupKey(deviceId + "_" + groupLabel.replaceAll("[^a-zA-Z0-9]", "_"));
                builder.groupLabel(groupLabel);
            }

            PointEntity point = builder.build();
            point.stampCreated(TenantBaseEntity.SYSTEM_USER_ID, Instant.now());
            points.add(pointDefinitionRepository.save(point));
        }

        return points;
    }

    /**
     * 根据设备索引构建不同的点位定义规格表。
     * 每行: [sortOrder, suffix, code, name, desc, unit, dataType, access, precision, dummy(9), valueMappings, groupLabel]
     */
    private List<Object[]> buildPointSpecs(String deviceName, int deviceIndex) {
        List<Object[]> specs = new ArrayList<>();
        switch (deviceIndex % 10) {
            case 0 -> { // 通用设备：温度+湿度+运行状态
                specs.add(new Object[]{1, "TEMP", "temperature", deviceName + "-温度", "环境温度传感器", "°C", DataType.DOUBLE, AccessType.RO, 1, null, null, "环境监测"});
                specs.add(new Object[]{2, "HUMI", "humidity", deviceName + "-湿度", "环境湿度传感器", "%RH", DataType.DOUBLE, AccessType.RO, 1, null, null, "环境监测"});
                specs.add(new Object[]{3, "STATUS", "run_status", deviceName + "-运行状态", "设备运行状态", null, DataType.BOOL, AccessType.RW, 0, null, "{\"0\":\"停机\",\"1\":\"运行\"}", null});
            }
            case 1 -> { // 电机设备：温度+转速+振动+电流+运行状态
                specs.add(new Object[]{1, "TEMP", "temperature", deviceName + "-温度", "电机绕组温度", "°C", DataType.DOUBLE, AccessType.RO, 1, null, null, "电机监测"});
                specs.add(new Object[]{2, "SPEED", "motor_speed", deviceName + "-转速", "电机转速", "rpm", DataType.INT, AccessType.RO, 0, null, null, "电机监测"});
                specs.add(new Object[]{3, "VIB", "vibration", deviceName + "-振动", "电机振动值", "mm/s", DataType.DOUBLE, AccessType.RO, 2, null, null, "电机监测"});
                specs.add(new Object[]{4, "CURRENT", "motor_current", deviceName + "-电流", "电机运行电流", "A", DataType.DOUBLE, AccessType.RO, 1, null, null, "电机监测"});
                specs.add(new Object[]{5, "STATUS", "run_status", deviceName + "-运行状态", "设备运行状态", null, DataType.BOOL, AccessType.RW, 0, null, "{\"0\":\"停机\",\"1\":\"运行\"}", null});
            }
            case 2 -> { // 泵站设备：流量+压力+温度+运行状态+功率
                specs.add(new Object[]{1, "FLOW", "flow_rate", deviceName + "-流量", "管道流量", "m³/h", DataType.DOUBLE, AccessType.RO, 2, null, null, "流体监测"});
                specs.add(new Object[]{2, "PRESS", "pressure", deviceName + "-压力", "管道压力", "MPa", DataType.DOUBLE, AccessType.RO, 3, null, null, "流体监测"});
                specs.add(new Object[]{3, "TEMP", "temperature", deviceName + "-温度", "介质温度", "°C", DataType.DOUBLE, AccessType.RO, 1, null, null, "流体监测"});
                specs.add(new Object[]{4, "STATUS", "run_status", deviceName + "-运行状态", "设备运行状态", null, DataType.BOOL, AccessType.RW, 0, null, "{\"0\":\"停机\",\"1\":\"运行\"}", null});
                specs.add(new Object[]{5, "POWER", "power", deviceName + "-功率", "泵组功率", "kW", DataType.FLOAT, AccessType.RO, 1, null, null, "能耗监测"});
            }
            case 3 -> { // 电表设备：电压+电流+功率+功率因数+频率
                specs.add(new Object[]{1, "VOLT", "voltage", deviceName + "-电压", "三相电压", "V", DataType.DOUBLE, AccessType.RO, 1, null, null, "电力监测"});
                specs.add(new Object[]{2, "CURR", "current", deviceName + "-电流", "三相电流", "A", DataType.DOUBLE, AccessType.RO, 2, null, null, "电力监测"});
                specs.add(new Object[]{3, "POWER", "active_power", deviceName + "-有功功率", "有功功率", "kW", DataType.DOUBLE, AccessType.RO, 2, null, null, "电力监测"});
                specs.add(new Object[]{4, "PF", "power_factor", deviceName + "-功率因数", "功率因数", "", DataType.FLOAT, AccessType.RO, 3, null, null, "电力监测"});
                specs.add(new Object[]{5, "FREQ", "frequency", deviceName + "-频率", "电网频率", "Hz", DataType.FLOAT, AccessType.RO, 2, null, null, "电力监测"});
            }
            default -> { // 通用回退：温度+运行状态
                specs.add(new Object[]{1, "TEMP", "temperature", deviceName + "-温度", "温度传感器", "°C", DataType.DOUBLE, AccessType.RO, 1, null, null, "环境监测"});
                specs.add(new Object[]{2, "STATUS", "run_status", deviceName + "-运行状态", "设备运行状态", null, DataType.BOOL, AccessType.RW, 0, null, "{\"0\":\"停机\",\"1\":\"运行\"}", null});
            }
        }
        return specs;
    }

    // ==================== 6. 告警规则 ====================
    private List<AlarmRuleEntity> seedAlarmRules(List<DeviceEntity> devices, List<PointEntity> allPoints,
                                                 List<NotifyUserEntity> notifyUsers) {
        List<AlarmRuleEntity> result = new ArrayList<>();
        List<String> notifyIds = notifyUsers.stream().map(NotifyUserEntity::getId).limit(3).toList();

        for (int idx = 0; idx < devices.size(); idx++) {
            DeviceEntity device = devices.get(idx);
            PointEntity tempPoint = findPoint(allPoints, device.getId(), "temperature");
            PointEntity statusPoint = findPoint(allPoints, device.getId(), "run_status");
            PointEntity pressPoint = findPoint(allPoints, device.getId(), "pressure");
            PointEntity vibPoint = findPoint(allPoints, device.getId(), "vibration");
            PointEntity flowPoint = findPoint(allPoints, device.getId(), "flow_rate");

            if (tempPoint != null) {
                AlarmRuleEntity highTemp = AlarmRuleEntity.builder()
                        .tenantId(device.getTenantId())
                        .ruleName(device.getDeviceName() + "-温度过高")
                        .source(AlarmRuleEntity.AlarmRuleSource.POINT)
                        .deviceId(device.getId())
                        .pointCode(tempPoint.getPointCode())
                        .ruleType(AlarmRuleEntity.AlarmRuleType.THRESHOLD)
                        .conditionType(AlarmConditionType.GT)
                        .threshold("35.0")
                        .level(AlarmLevel.WARNING)
                        .message("设备温度过高（>35°C），请检查散热")
                        .enabled(true)
                        .maskEnable(false)
                        .notifyUserIds(notifyIds)
                        .suppressType(AlarmSuppressType.NONE)
                        .build();
                highTemp.stampCreated(TenantBaseEntity.SYSTEM_USER_ID, Instant.now());
                result.add(alarmRuleRepository.save(highTemp));

                if (idx < 3) {
                    AlarmRuleEntity lowTemp = AlarmRuleEntity.builder()
                            .tenantId(device.getTenantId())
                            .ruleName(device.getDeviceName() + "-温度过低")
                            .source(AlarmRuleEntity.AlarmRuleSource.POINT)
                            .deviceId(device.getId())
                            .pointCode(tempPoint.getPointCode())
                            .ruleType(AlarmRuleEntity.AlarmRuleType.THRESHOLD)
                            .conditionType(AlarmConditionType.LT)
                            .threshold("5.0")
                            .level(AlarmLevel.WARNING)
                            .message("设备温度过低（<5°C），请检查环境")
                            .enabled(true)
                            .maskEnable(false)
                            .notifyUserIds(notifyIds)
                            .suppressType(AlarmSuppressType.NONE)
                            .build();
                    lowTemp.stampCreated(TenantBaseEntity.SYSTEM_USER_ID, Instant.now());
                    result.add(alarmRuleRepository.save(lowTemp));
                }
            }

            if (statusPoint != null) {
                AlarmRuleEntity stopAlarm = AlarmRuleEntity.builder()
                        .tenantId(device.getTenantId())
                        .ruleName(device.getDeviceName() + "-异常停机")
                        .source(AlarmRuleEntity.AlarmRuleSource.POINT)
                        .deviceId(device.getId())
                        .pointCode(statusPoint.getPointCode())
                        .ruleType(AlarmRuleEntity.AlarmRuleType.STATE)
                        .conditionType(AlarmConditionType.EQ)
                        .threshold("0")
                        .level(AlarmLevel.INFO)
                        .message("设备异常停机")
                        .enabled(true)
                        .maskEnable(false)
                        .notifyUserIds(notifyIds)
                        .suppressType(AlarmSuppressType.SLIDING_WINDOW)
                        .build();
                stopAlarm.stampCreated(TenantBaseEntity.SYSTEM_USER_ID, Instant.now());
                result.add(alarmRuleRepository.save(stopAlarm));
            }

            // 压力告警（仅前5个设备且有点位的）
            if (pressPoint != null && idx < 5) {
                AlarmRuleEntity highPress = AlarmRuleEntity.builder()
                        .tenantId(device.getTenantId())
                        .ruleName(device.getDeviceName() + "-压力过高")
                        .source(AlarmRuleEntity.AlarmRuleSource.POINT)
                        .deviceId(device.getId())
                        .pointCode(pressPoint.getPointCode())
                        .ruleType(AlarmRuleEntity.AlarmRuleType.THRESHOLD)
                        .conditionType(AlarmConditionType.GT)
                        .threshold("0.8")
                        .level(AlarmLevel.CRITICAL)
                        .message("管道压力过高（>0.8MPa），存在安全风险")
                        .enabled(true).maskEnable(false)
                        .notifyUserIds(notifyIds)
                        .suppressType(AlarmSuppressType.NONE)
                        .build();
                highPress.stampCreated(TenantBaseEntity.SYSTEM_USER_ID, Instant.now());
                result.add(alarmRuleRepository.save(highPress));
            }

            // 振动告警（仅前3个设备且有点位的）
            if (vibPoint != null && idx < 3) {
                AlarmRuleEntity highVib = AlarmRuleEntity.builder()
                        .tenantId(device.getTenantId())
                        .ruleName(device.getDeviceName() + "-振动过大")
                        .source(AlarmRuleEntity.AlarmRuleSource.POINT)
                        .deviceId(device.getId())
                        .pointCode(vibPoint.getPointCode())
                        .ruleType(AlarmRuleEntity.AlarmRuleType.THRESHOLD)
                        .conditionType(AlarmConditionType.GT)
                        .threshold("7.1")
                        .level(AlarmLevel.CRITICAL)
                        .message("电机振动值超标（>7.1mm/s），需立即检修")
                        .enabled(true).maskEnable(false)
                        .notifyUserIds(notifyIds)
                        .suppressType(AlarmSuppressType.NONE)
                        .build();
                highVib.stampCreated(TenantBaseEntity.SYSTEM_USER_ID, Instant.now());
                result.add(alarmRuleRepository.save(highVib));
            }

            // 流量告警（仅前2个设备且有点位的）
            if (flowPoint != null && idx < 2) {
                AlarmRuleEntity lowFlow = AlarmRuleEntity.builder()
                        .tenantId(device.getTenantId())
                        .ruleName(device.getDeviceName() + "-流量异常")
                        .source(AlarmRuleEntity.AlarmRuleSource.POINT)
                        .deviceId(device.getId())
                        .pointCode(flowPoint.getPointCode())
                        .ruleType(AlarmRuleEntity.AlarmRuleType.THRESHOLD)
                        .conditionType(AlarmConditionType.LT)
                        .threshold("1.0")
                        .level(AlarmLevel.WARNING)
                        .message("管道流量异常偏低（<1.0m³/h），请检查管路")
                        .enabled(true).maskEnable(false)
                        .notifyUserIds(notifyIds)
                        .suppressType(AlarmSuppressType.NONE)
                        .build();
                lowFlow.stampCreated(TenantBaseEntity.SYSTEM_USER_ID, Instant.now());
                result.add(alarmRuleRepository.save(lowFlow));
            }
        }
        log.info("[数据播种] 告警规则: {} 条", result.size());
        return result;
    }

    private PointEntity findPoint(List<PointEntity> allPoints, String deviceId, String pointCode) {
        return allPoints.stream()
                .filter(p -> p.getDeviceId().equals(deviceId) && pointCode.equals(p.getPointCode()))
                .findFirst().orElse(null);
    }

    // ==================== 7. 控制记录 ====================
    private List<ControlRecordEntity> seedControlRecords(List<DeviceEntity> devices,
                                                         List<PointEntity> allPoints,
                                                         AccountEntity operator) {
        List<ControlRecordEntity> result = new ArrayList<>();

        String[] usernames = {operator.getUsername(), "demo_admin", "operator1"};

        for (int i = 0; i < Math.min(8, devices.size()); i++) {
            DeviceEntity device = devices.get(i);
            PointEntity rwPoint = findPoint(allPoints, device.getId(), "run_status");
            if (rwPoint == null) continue;

            // 模拟启动和停机操作
            boolean isStart = random.nextBoolean();
            String inputVal = isStart ? "1" : "0";
            String writtenVal = isStart ? "1" : "0";

            OperationResult status;
            String errorMessage = null;
            if (i < 5) status = OperationResult.SUCCESS;
            else if (i == 5) status = OperationResult.PENDING;
            else {
                status = OperationResult.FAIL;
                errorMessage = i % 2 == 0 ? "设备无响应" : "下发超时";
            }

            ControlRecordEntity record = ControlRecordEntity.builder()
                    .tenantId(device.getTenantId())
                    .deviceId(device.getId())
                    .deviceName(device.getDeviceName())
                    .pointCode(rwPoint.getPointCode())
                    .pointName(rwPoint.getPointName())
                    .inputValue(inputVal)
                    .writtenValue(writtenVal)
                    .username(usernames[i % usernames.length])
                    .status(status)
                    .errorMessage(errorMessage)
                    .occurredAt(Instant.now().minus(random.nextInt(72), ChronoUnit.HOURS))
                    .writtenAt(status == OperationResult.SUCCESS
                            ? Instant.now().minus(random.nextInt(72), ChronoUnit.HOURS).plusSeconds(2)
                            : null)
                    .build();
            record.stampCreated(TenantBaseEntity.SYSTEM_USER_ID, Instant.now());
            result.add(controlRecordRepository.save(record));
        }
        log.info("[数据播种] 控制记录: {} 条", result.size());
        return result;
    }

    // ==================== 8. 定时规则 ====================
    private List<DeviceScheduleEntity> seedSchedules(List<DeviceEntity> devices, List<PointEntity> allPoints) {
        List<DeviceScheduleEntity> result = new ArrayList<>();

        // 为前 6 个设备创建定时规则
        String[][] cronSpecs = {
                {"0 0 8 * * ?", "1", "每天8点开机"},
                {"0 0 20 * * ?", "0", "每天20点关机"},
                {"0 0/30 * * * ?", "1", "每30分钟巡检"},
                {"0 0 7 * * 1-5", "1", "工作日早7点启动"},
                {"0 0 18 * * 1-5", "0", "工作日晚6点停机"},
                {"0 0 0 1 * ?", "0", "每月1号凌晨保养停机"}
        };

        for (int i = 0; i < Math.min(6, devices.size()); i++) {
            DeviceEntity device = devices.get(i);
            PointEntity rwPoint = findPoint(allPoints, device.getId(), "run_status");
            if (rwPoint == null) continue;

            String[] spec = cronSpecs[i];
            ScheduleAction action = new ScheduleAction();
            action.setPointId(rwPoint.getId());
            action.setPointCode(rwPoint.getPointCode());
            action.setValueText(spec[1]);
            action.setSortOrder(1);

            DeviceScheduleEntity schedule = DeviceScheduleEntity.builder()
                    .tenantId(device.getTenantId())
                    .deviceId(device.getId())
                    .name(spec[2])
                    .cron(spec[0])
                    .enabled(true)
                    .description("种子数据生成的定时规则 - " + spec[0])
                    .actions(new ArrayList<>(List.of(action)))
                    .build();
            schedule.stampCreated(TenantBaseEntity.SYSTEM_USER_ID, Instant.now());
            result.add(deviceScheduleRepository.save(schedule));
        }
        log.info("[数据播种] 定时规则: {} 条", result.size());
        return result;
    }

    // ==================== 9. 设备面板 ====================
    private List<DevicePanelEntity> seedDevicePanels(List<DeviceEntity> devices, List<PointEntity> allPoints) {
        List<DevicePanelEntity> result = new ArrayList<>();

        for (int di = 0; di < devices.size(); di++) {
            DeviceEntity device = devices.get(di);
            DevicePanelEntity existing = devicePanelRepository.findByDeviceId(device.getId()).orElse(null);
            if (existing != null) {
                result.add(existing);
                continue;
            }

            Map<String, Object> panelConfig = new LinkedHashMap<>();
            panelConfig.put("version", 1);

            List<Map<String, Object>> widgets = new ArrayList<>();
            List<PointEntity> devicePoints = allPoints.stream()
                    .filter(p -> p.getDeviceId().equals(device.getId()))
                    .sorted(Comparator.comparingInt(p -> p.getSortOrder() != null ? p.getSortOrder() : 0))
                    .toList();

            int col = 0;
            int row = 0;
            for (PointEntity point : devicePoints) {
                String plugin;
                Map<String, Object> props = new LinkedHashMap<>();

                if (point.getDataType() == DataType.BOOL) {
                    if (AccessType.RW.equals(point.getAccess())) {
                        plugin = "control-switch";
                    } else {
                        plugin = "switch-light";
                    }
                    props.put("showUnit", false);
                } else if (point.getDataType() == DataType.INT || point.getDataType() == DataType.DOUBLE
                        || point.getDataType() == DataType.FLOAT) {
                    plugin = "metric-value";
                    props.put("showUnit", point.getUnit() != null && !point.getUnit().isEmpty());
                    props.put("precision", point.getPrecision() != null ? point.getPrecision() : 1);
                } else {
                    plugin = "status-badge";
                    props.put("showUnit", false);
                }

                Map<String, Object> widget = new LinkedHashMap<>();
                widget.put("id", "w_" + device.getId() + "_" + point.getPointCode());
                widget.put("title", point.getPointName().replace(device.getDeviceName() + "-", ""));
                widget.put("layout", Map.of("x", col * 3, "y", row * 3, "w", 3, "h", 3));
                widget.put("binding", Map.of("kind", "point", "pointCode", point.getPointCode()));
                widget.put("plugin", plugin);
                widget.put("source", "realtime");
                widget.put("props", props);
                widgets.add(widget);

                col++;
                if (col >= 4) {
                    col = 0;
                    row++;
                }
            }

            // 为第一个 DOUBLE/FLOAT 点位添加趋势曲线（line-chart）
            PointEntity historyPoint = devicePoints.stream()
                    .filter(p -> p.getDataType() == DataType.DOUBLE || p.getDataType() == DataType.FLOAT)
                    .findFirst().orElse(null);
            if (historyPoint != null) {
                Map<String, Object> trendWidget = new LinkedHashMap<>();
                trendWidget.put("id", "w_" + device.getId() + "_trend");
                trendWidget.put("title", historyPoint.getPointName().replace(device.getDeviceName() + "-", "") + " 趋势");
                trendWidget.put("layout", Map.of("x", col * 3, "y", row * 3, "w", 6, "h", 4));
                trendWidget.put("binding", Map.of("kind", "point", "pointCode", historyPoint.getPointCode()));
                trendWidget.put("plugin", "line-chart");
                trendWidget.put("source", "history");
                trendWidget.put("props", Map.of("range", "24h"));
                widgets.add(trendWidget);
                col += 2;
                if (col >= 4) {
                    col = 0;
                    row++;
                }
            }

            // 为第一个 DOUBLE/FLOAT 点位添加仪表盘（gauge）
            if (historyPoint != null && col < 3) {
                Map<String, Object> gaugeWidget = new LinkedHashMap<>();
                gaugeWidget.put("id", "w_" + device.getId() + "_gauge");
                gaugeWidget.put("title", historyPoint.getPointName().replace(device.getDeviceName() + "-", "") + " 仪表");
                gaugeWidget.put("layout", Map.of("x", col * 3, "y", row * 3, "w", 3, "h", 4));
                gaugeWidget.put("binding", Map.of("kind", "point", "pointCode", historyPoint.getPointCode()));
                gaugeWidget.put("plugin", "gauge");
                gaugeWidget.put("source", "realtime");
                gaugeWidget.put("props", Map.of("showUnit", true));
                widgets.add(gaugeWidget);
            }

            panelConfig.put("widgets", widgets);

            DevicePanelEntity panel = DevicePanelEntity.builder()
                    .tenantId(device.getTenantId())
                    .deviceId(device.getId())
                    .panelConfig(panelConfig)
                    .build();
            panel.stampCreated(TenantBaseEntity.SYSTEM_USER_ID, Instant.now());
            result.add(devicePanelRepository.save(panel));
        }
        log.info("[数据播种] 设备面板: {} 个", result.size());
        return result;
    }

    // ==================== 10. 告警事件 ====================
    private List<AlarmLogEntity> seedAlarmLogs(List<AlarmRuleEntity> rules) {
        List<AlarmLogEntity> result = new ArrayList<>();
        if (rules.isEmpty()) {
            log.info("[数据播种] 告警事件: 跳过（无可用告警规则）");
            return result;
        }

        // 5 ACTIVE/UNACK + 2 ACK + 1 RECOVERED
        int[] statusPattern = {0, 0, 0, 0, 0, 1, 1, 2};
        Random r = new Random(42);

        for (int i = 0; i < statusPattern.length && i < rules.size() * 2; i++) {
            AlarmRuleEntity rule = rules.get(i / 2);
            int pattern = statusPattern[i];

            EventStatus eventStatus = switch (pattern) {
                case 0 -> EventStatus.ACTIVE;
                case 1 -> EventStatus.ACK;
                default -> EventStatus.RECOVERED;
            };
            AlarmAckStatus ackStatus = pattern == 0 ? AlarmAckStatus.UNACK : AlarmAckStatus.ACK;

            String triggerValue = "temperature".equals(rule.getPointCode())
                    ? "37." + r.nextInt(10)
                    : "0";

            Instant triggeredAt = Instant.now().minus(r.nextInt(72) + 1, ChronoUnit.HOURS);
            AlarmLogEntity logEntity = AlarmLogEntity.builder()
                    .tenantId(rule.getTenantId())
                    .source(rule.getSource())
                    .deviceId(rule.getDeviceId())
                    .pointCode(rule.getPointCode())
                    .ruleId(rule.getId())
                    .level(rule.getLevel() == null ? AlarmLevel.WARNING : rule.getLevel())
                    .message(rule.getMessage())
                    .triggerValue(triggerValue)
                    .eventStatus(eventStatus)
                    .acknowledged(ackStatus)
                    .triggeredAt(triggeredAt)
                    .occurTime(triggeredAt)
                    .recoveredAt(pattern == 2 ? triggeredAt.plus(30, ChronoUnit.MINUTES) : null)
                    .acknowledgedAt(pattern >= 1 ? triggeredAt.plus(10, ChronoUnit.MINUTES) : null)
                    .acknowledgedBy(pattern >= 1 ? "demo_admin" : null)
                    .triggerCount(pattern == 0 ? r.nextInt(3) + 1 : 1)
                    .build();
            logEntity.stampCreated(TenantBaseEntity.SYSTEM_USER_ID, triggeredAt);
            result.add(alarmLogRepository.save(logEntity));
        }
        log.info("[数据播种] 告警事件: {} 条", result.size());
        return result;
    }

    // ==================== 11. 通知发送记录 ====================
    private List<NotifyRecordEntity> seedNotifyRecords(Map<String, NotifyUserEntity> notifyUsers,
                                                       List<AlarmLogEntity> alarmLogs) {
        List<NotifyRecordEntity> result = new ArrayList<>();
        if (alarmLogs.isEmpty() || notifyUsers.isEmpty()) {
            log.info("[数据播种] 通知记录: 跳过（无告警事件或通知人）");
            return result;
        }

        Random r = new Random(99);
        List<NotifyUserEntity> users = new ArrayList<>(notifyUsers.values());

        for (int i = 0; i < Math.min(5, alarmLogs.size()); i++) {
            AlarmLogEntity alarmLog = alarmLogs.get(i);
            int userCount = 1 + r.nextInt(2);

            for (int j = 0; j < userCount && j < users.size(); j++) {
                NotifyUserEntity user = users.get(j);
                NotifyRecordStatus status = r.nextDouble() < 0.85
                        ? NotifyRecordStatus.SUCCESS
                        : NotifyRecordStatus.FAILED;
                String levelName = alarmLog.getLevel() == null ? "" : alarmLog.getLevel().name();
                String content = String.format("【IoT平台】设备触发%s报警：%s", levelName, alarmLog.getMessage());

                NotifyRecordEntity record = NotifyRecordEntity.builder()
                        .tenantId(alarmLog.getTenantId())
                        .time(alarmLog.getTriggeredAt())
                        .event(String.format("设备 %s 报警", alarmLog.getDeviceId()))
                        .notifyUserIds(List.of(user.getId()))
                        .channel(NotifyChannelType.SMS)
                        .status(status)
                        .content(content)
                        .params(String.format("{\"deviceId\":\"%s\",\"level\":\"%s\"}",
                                alarmLog.getDeviceId(), levelName))
                        .error(status == NotifyRecordStatus.FAILED ? "网关超时" : null)
                        .build();
                record.stampCreated(TenantBaseEntity.SYSTEM_USER_ID, alarmLog.getTriggeredAt());
                result.add(notifyRecordRepository.save(record));
            }
        }
        log.info("[数据播种] 通知记录: {} 条", result.size());
        return result;
    }

    // ==================== 12. 历史数据 ====================
    private List<DataEntity> seedHistoryData(List<DeviceEntity> devices, List<PointEntity> allPoints, int days) {
        List<DataEntity> allHistoryData = new ArrayList<>();
        if (days <= 0 || allPoints.isEmpty()) {
            log.info("[数据播种] 历史数据: 跳过（historyDays={} points={}）", days, allPoints.size());
            return allHistoryData;
        }

        for (PointEntity point : allPoints) {
            String deviceName = devices.stream()
                    .filter(d -> d.getId().equals(point.getDeviceId()))
                    .map(DeviceEntity::getDeviceName).findFirst().orElse("Unknown");
            allHistoryData.addAll(generateHistoryData(point, deviceName, days));
        }

        // 批量保存历史数据，最后一条通过 DataService.save() 触发 DataUpdateEvent
        long startTime = System.currentTimeMillis();
        if (allHistoryData.size() > 1) {
            dataService.saveAllBatch(allHistoryData.subList(0, allHistoryData.size() - 1));
            dataService.save(allHistoryData.get(allHistoryData.size() - 1));
        } else if (!allHistoryData.isEmpty()) {
            dataService.save(allHistoryData.get(0));
        }
        log.info("[数据播种] 历史数据: {} 条，耗时 {}ms",
                allHistoryData.size(), System.currentTimeMillis() - startTime);
        return allHistoryData;
    }

    /**
     * 为点位生成指定天数的历史数据，每条数据之间时间间隔随机
     */
    private List<DataEntity> generateHistoryData(PointEntity point, String deviceName, int days) {
        List<DataEntity> dataList = new ArrayList<>();
        Instant startTime = Instant.now().minus(days, ChronoUnit.DAYS).truncatedTo(ChronoUnit.DAYS);
        Instant endTime = Instant.now();
        Instant currentTime = startTime;

        while (currentTime.isBefore(endTime)) {
            dataList.add(buildDataEntity(point, deviceName, currentTime));
            long intervalMinutes = MIN_INTERVAL_MINUTES
                    + random.nextLong(MAX_INTERVAL_MINUTES - MIN_INTERVAL_MINUTES + 1);
            currentTime = currentTime.plus(intervalMinutes, ChronoUnit.MINUTES);
        }
        return dataList;
    }

    /**
     * 根据数据类型和点位编码构建数据实体（生成符合物理范围的合理值）
     */
    private DataEntity buildDataEntity(PointEntity point, String deviceName, Instant timestamp) {
        var builder = DataEntity.builder()
                .tenantId(point.getTenantId())
                .deviceId(point.getDeviceId()).deviceName(deviceName)
                .pointCode(point.getPointCode()).pointId(point.getId())
                .pointName(point.getPointName()).unit(point.getUnit())
                .dataType(point.getDataType()).timestamp(timestamp)
                .ingestedAt(Instant.now()).dataState(PointDataState.NORMAL);

        switch (point.getDataType()) {
            case BOOL -> {
                // 根据点位编码决定 BOOL 值的倾向
                String code = point.getPointCode();
                if ("run_status".equals(code)) {
                    builder.intValue(random.nextDouble() < 0.8 ? 1L : 0L); // 80% 运行
                } else if ("burn_status".equals(code)) {
                    builder.intValue(random.nextDouble() < 0.85 ? 1L : 0L); // 85% 燃烧
                } else if ("temp_alarm".equals(code)) {
                    builder.intValue(random.nextDouble() < 0.1 ? 1L : 0L); // 10% 报警
                } else {
                    builder.intValue(random.nextDouble() < 0.5 ? 1L : 0L);
                }
            }
            case INT -> {
                String code = point.getPointCode();
                long value;
                switch (code) {
                    case "motor_speed" -> value = 1200 + random.nextLong(600); // 1200~1800 rpm
                    case "output_count" -> value = 100 + random.nextLong(900); // 100~1000 件
                    case "water_level" -> value = 30 + random.nextLong(50); // 30~80 %
                    case "pm25" -> value = 20 + random.nextLong(80); // 20~100 μg/m³
                    default -> value = random.nextLong(100);
                }
                builder.intValue(value);
            }
            case FLOAT -> {
                String code = point.getPointCode();
                double v;
                switch (code) {
                    case "motor_current" -> v = 5.0 + random.nextDouble() * 15.0; // 5~20 A
                    case "vibration" -> v = 1.0 + random.nextDouble() * 6.0; // 1~7 mm/s
                    case "power" -> v = 10.0 + random.nextDouble() * 90.0; // 10~100 kW
                    case "power_factor" -> v = 0.7 + random.nextDouble() * 0.25; // 0.7~0.95
                    case "frequency" -> v = 49.5 + random.nextDouble() * 1.0; // 49.5~50.5 Hz
                    case "yield_rate" -> v = 85.0 + random.nextDouble() * 15.0; // 85~100 %
                    case "takt_time" -> v = 10.0 + random.nextDouble() * 50.0; // 10~60 s
                    case "oee" -> v = 60.0 + random.nextDouble() * 35.0; // 60~95 %
                    default -> v = 20.0 + random.nextDouble() * 15.5;
                }
                builder.doubleValue(Math.round(v * 10.0) / 10.0);
            }
            case DOUBLE -> {
                String code = point.getPointCode();
                double value;
                switch (code) {
                    case "temperature" -> value = 15.0 + random.nextDouble() * 25.0; // 15~40 °C
                    case "humidity" -> value = 30.0 + random.nextDouble() * 50.0; // 30~80 %RH
                    case "pressure" -> value = 0.2 + random.nextDouble() * 0.6; // 0.2~0.8 MPa
                    case "pressure_out" -> value = 0.1 + random.nextDouble() * 0.5; // 0.1~0.6 MPa
                    case "flow_rate" -> value = 2.0 + random.nextDouble() * 18.0; // 2~20 m³/h
                    case "air_pressure" -> value = 0.5 + random.nextDouble() * 0.3; // 0.5~0.8 MPa
                    case "dew_point" -> value = -20.0 + random.nextDouble() * 25.0; // -20~5 °C
                    case "voltage" -> value = 370.0 + random.nextDouble() * 50.0; // 370~420 V
                    case "current" -> value = 10.0 + random.nextDouble() * 90.0; // 10~100 A
                    case "active_power" -> value = 5.0 + random.nextDouble() * 95.0; // 5~100 kW
                    case "steam_flow" -> value = 1.0 + random.nextDouble() * 9.0; // 1~10 t/h
                    case "noise" -> value = 50.0 + random.nextDouble() * 40.0; // 50~90 dB
                    case "current_temp" -> value = 18.0 + random.nextDouble() * 22.0; // 18~40 °C
                    case "target_temp" -> value = 25.0 + random.nextDouble() * 10.0; // 25~35 °C
                    case "temp_deviation" -> value = -2.0 + random.nextDouble() * 4.0; // -2~2 °C
                    default -> value = 20.0 + random.nextDouble() * 30.0;
                }
                builder.doubleValue(Math.round(value * 100.0) / 100.0);
            }
            case STRING -> {
                String[] s = {"running", "idle", "error", "warning"};
                builder.stringValue(s[random.nextInt(s.length)]);
            }
        }
        DataEntity entity = builder.build();
        entity.stampCreated(TenantBaseEntity.SYSTEM_USER_ID, Instant.now());
        return entity;
    }

    // ==================== 13. 设备模版 ====================
    private List<DeviceTemplateEntity> seedDeviceTemplates(List<DeviceEntity> devices) {
        List<DeviceTemplateEntity> result = new ArrayList<>();
        String[][] templates = {
                {"通用设备模版", "通用监控：温度、湿度、运行状态", "USR_G771_EDGE", "demo"},
                {"电机设备模版", "电机监控：温度、转速、振动、电流", "USR_G771_EDGE", "demo"},
                {"泵站设备模版", "泵站监控：流量、压力、温度、功率", "USR_G771_EDGE", "prod"},
                {"电力监测模版", "配电间监测：电压、电流、功率、频率", "USR_G771_EDGE", "prod"},
                {"环境监测模版", "环境监测：温度、湿度、PM2.5、噪声", "USR_G771_EDGE", "prod"}
        };
        for (int i = 0; i < templates.length; i++) {
            String[] spec = templates[i];
            String tid = "TPL_" + String.format("%03d", i + 1);
            DeviceTemplateEntity ex = deviceTemplateRepository.findById(tid).orElse(null);
            if (ex != null) {
                result.add(ex);
                continue;
            }
            DeviceTemplateEntity t = DeviceTemplateEntity.builder().id(tid)
                    .tenantId("demo".equals(spec[3]) ? "demo-tenant" : "prod-tenant")
                    .templateName(spec[0]).description(spec[1])
                    .gatewayType(GatewayType.USR_G771_EDGE.name())
                    .pointConfig("{\"points\":[]}").scheduleConfig("{\"schedules\":[]}")
                    .panelConfig("{\"widgets\":[]}").enabled(true).build();
            t.stampCreated(TenantBaseEntity.SYSTEM_USER_ID, Instant.now());
            result.add(deviceTemplateRepository.save(t));
        }
        log.info("[数据播种] 设备模版: {} 个", result.size());
        return result;
    }

    // ==================== 14. 报表定义 ====================
    private List<ReportDefinitionEntity> seedReportDefinitions(TenantEntity demo, TenantEntity prod) {
        List<ReportDefinitionEntity> result = new ArrayList<>();
        ReportSchema s1 = new ReportSchema();
        s1.setSource(ReportDataSource.DEVICE);
        s1.setColumns(List.of(
                new ReportColumnDef("设备名称", null, ReportDataSource.DEVICE, "deviceName", ReportAggFunc.NONE, ReportDisplayFormat.strings, null, null),
                new ReportColumnDef("网关类型", null, ReportDataSource.DEVICE, "gatewayType", ReportAggFunc.NONE, ReportDisplayFormat.strings, null, null),
                new ReportColumnDef("在线状态", null, ReportDataSource.DEVICE, "online", ReportAggFunc.NONE, ReportDisplayFormat.strings, null, null),
                new ReportColumnDef("车间", null, ReportDataSource.DEVICE, "level1Tag", ReportAggFunc.NONE, ReportDisplayFormat.strings, null, null)));
        s1.setSort(List.of(new ReportSortItem(ReportDataSource.DEVICE, "deviceName", ReportSortDirection.ASC)));
        s1.setLimit(100);
        ReportDefinitionEntity r1 = ReportDefinitionEntity.builder().tenantId(demo.getId())
                .name("设备运行汇总").description("查看所有设备基本信息和在线状态")
                .schemaJson(toJson(s1)).enabled(true).build();
        r1.stampCreated(TenantBaseEntity.SYSTEM_USER_ID, Instant.now());
        result.add(reportDefinitionRepository.save(r1));

        ReportSchema s2 = new ReportSchema();
        s2.setSource(ReportDataSource.POINT_HISTORY);
        s2.setColumns(List.of(
                new ReportColumnDef("设备", null, ReportDataSource.POINT_HISTORY, "deviceName", ReportAggFunc.NONE, ReportDisplayFormat.strings, null, null),
                new ReportColumnDef("点位", null, ReportDataSource.POINT_HISTORY, "pointName", ReportAggFunc.NONE, ReportDisplayFormat.strings, null, null),
                new ReportColumnDef("时间", null, ReportDataSource.POINT_HISTORY, "timestamp", ReportAggFunc.NONE, ReportDisplayFormat.strings, null, null),
                new ReportColumnDef("均值", null, ReportDataSource.POINT_HISTORY, "doubleValue", ReportAggFunc.AVG, ReportDisplayFormat.decimal2, null, null)));
        s2.setBreakout(new ReportBreakout(ReportDataSource.POINT_HISTORY, "deviceName"));
        s2.setSort(List.of(new ReportSortItem(ReportDataSource.POINT_HISTORY, "timestamp", ReportSortDirection.DESC)));
        s2.setLimit(5000);
        ReportDefinitionEntity r2 = ReportDefinitionEntity.builder().tenantId(demo.getId())
                .name("历史数据趋势").description("按设备分组查看历史数据趋势")
                .schemaJson(toJson(s2)).enabled(true).build();
        r2.stampCreated(TenantBaseEntity.SYSTEM_USER_ID, Instant.now());
        result.add(reportDefinitionRepository.save(r2));

        ReportSchema s3 = new ReportSchema();
        s3.setSource(ReportDataSource.DEVICE);
        s3.setColumns(List.of(
                new ReportColumnDef("设备", null, ReportDataSource.DEVICE, "deviceName", ReportAggFunc.NONE, ReportDisplayFormat.strings, null, null),
                new ReportColumnDef("设备数", null, ReportDataSource.DEVICE, "id", ReportAggFunc.COUNT, ReportDisplayFormat.integer, null, null)));
        s3.setLimit(100);
        ReportDefinitionEntity r3 = ReportDefinitionEntity.builder().tenantId(prod.getId())
                .name("生产环境设备清单").description("生产环境设备列表报表")
                .schemaJson(toJson(s3)).enabled(true).build();
        r3.stampCreated(TenantBaseEntity.SYSTEM_USER_ID, Instant.now());
        result.add(reportDefinitionRepository.save(r3));

        ReportSchema s4 = new ReportSchema();
        s4.setSource(ReportDataSource.POINT_REALTIME);
        s4.setColumns(List.of(
                new ReportColumnDef("设备", null, ReportDataSource.POINT_REALTIME, "deviceName", ReportAggFunc.NONE, ReportDisplayFormat.strings, null, null),
                new ReportColumnDef("点位", null, ReportDataSource.POINT_REALTIME, "pointName", ReportAggFunc.NONE, ReportDisplayFormat.strings, null, null),
                new ReportColumnDef("当前值", null, ReportDataSource.POINT_REALTIME, "doubleValue", ReportAggFunc.NONE, ReportDisplayFormat.decimal2, null, null),
                new ReportColumnDef("单位", null, ReportDataSource.POINT_REALTIME, "unit", ReportAggFunc.NONE, ReportDisplayFormat.strings, null, null)));
        s4.setLimit(500);
        ReportDefinitionEntity r4 = ReportDefinitionEntity.builder().tenantId(demo.getId())
                .name("实时数据概览").description("查看所有设备点位实时数据")
                .schemaJson(toJson(s4)).enabled(true).build();
        r4.stampCreated(TenantBaseEntity.SYSTEM_USER_ID, Instant.now());
        result.add(reportDefinitionRepository.save(r4));
        log.info("[数据播种] 报表定义: {} 个", result.size());
        return result;
    }

    private String toJson(Object obj) {
        try {
            return objectMapper.writeValueAsString(obj);
        } catch (Exception e) {
            log.warn("JSON 序列化失败: {}", e.getMessage());
            return "{}";
        }
    }

    // ==================== 15. AI 用户画像 ====================
    private List<AiUserProfileEntity> seedAiUserProfiles(Map<String, AccountEntity> accounts,
                                                         TenantEntity demo, TenantEntity prod) {
        List<AiUserProfileEntity> result = new ArrayList<>();
        AccountEntity da = accounts.get("demo_admin");
        AccountEntity o1 = accounts.get("operator1");
        AccountEntity pa = accounts.get("prod_admin");
        AccountEntity o2 = accounts.get("operator2");

        if (da != null) {
            result.add(aiUserProfileRepository.save(AiUserProfileEntity.builder()
                    .id("AI_PROFILE_DEMO_ADMIN").userId(da.getId()).tenantId(demo.getId())
                    .favoriteDeviceIds("[\"DEV_001\",\"DEV_002\",\"DEV_003\"]")
                    .resourceUsageStats("{\"device\":15,\"data\":25,\"alarm_event\":5}")
                    .actionUsageStats("{\"query\":30,\"count\":10,\"trend\":8}")
                    .totalChats(53).lastActiveAt(Instant.now().minus(2, ChronoUnit.HOURS))
                    .queryPreferences("{\"pageSize\":20}")
                    .createdAt(Instant.now().minus(30, ChronoUnit.DAYS))
                    .updatedAt(Instant.now().minus(2, ChronoUnit.HOURS)).build()));
        }
        if (o1 != null) {
            result.add(aiUserProfileRepository.save(AiUserProfileEntity.builder()
                    .id("AI_PROFILE_OP1").userId(o1.getId()).tenantId(demo.getId())
                    .favoriteDeviceIds("[\"DEV_001\",\"DEV_004\"]")
                    .resourceUsageStats("{\"data\":20,\"device\":5,\"alarm_rule\":3}")
                    .actionUsageStats("{\"query\":18,\"count\":5,\"trend\":12}")
                    .totalChats(35).lastActiveAt(Instant.now().minus(5, ChronoUnit.HOURS))
                    .queryPreferences("{\"pageSize\":10}")
                    .createdAt(Instant.now().minus(20, ChronoUnit.DAYS))
                    .updatedAt(Instant.now().minus(5, ChronoUnit.HOURS)).build()));
        }
        if (pa != null) {
            result.add(aiUserProfileRepository.save(AiUserProfileEntity.builder()
                    .id("AI_PROFILE_PROD_ADMIN").userId(pa.getId()).tenantId(prod.getId())
                    .favoriteDeviceIds("[\"DEV_006\",\"DEV_007\",\"DEV_008\",\"DEV_009\"]")
                    .resourceUsageStats("{\"device\":22,\"data\":18,\"alarm_event\":8}")
                    .actionUsageStats("{\"query\":35,\"count\":15,\"trend\":5}")
                    .totalChats(60).lastActiveAt(Instant.now().minus(1, ChronoUnit.HOURS))
                    .queryPreferences("{\"pageSize\":25}")
                    .createdAt(Instant.now().minus(45, ChronoUnit.DAYS))
                    .updatedAt(Instant.now().minus(1, ChronoUnit.HOURS)).build()));
        }
        if (o2 != null) {
            result.add(aiUserProfileRepository.save(AiUserProfileEntity.builder()
                    .id("AI_PROFILE_OP2").userId(o2.getId()).tenantId(prod.getId())
                    .favoriteDeviceIds("[\"DEV_006\",\"DEV_010\"]")
                    .resourceUsageStats("{\"data\":12,\"device\":3}")
                    .actionUsageStats("{\"query\":10,\"trend\":6}")
                    .totalChats(16).lastActiveAt(Instant.now().minus(12, ChronoUnit.HOURS))
                    .queryPreferences("{\"pageSize\":10}")
                    .createdAt(Instant.now().minus(15, ChronoUnit.DAYS))
                    .updatedAt(Instant.now().minus(12, ChronoUnit.HOURS)).build()));
        }
        log.info("[数据播种] AI 用户画像: {} 个", result.size());
        return result;
    }

    // ==================== 16. AI 对话记忆 ====================
    private List<AiChatMemoryEntity> seedAiChatMemories(Map<String, AccountEntity> accounts,
                                                        TenantEntity demo) {
        List<AiChatMemoryEntity> result = new ArrayList<>();
        AccountEntity da = accounts.get("demo_admin");
        AccountEntity o1 = accounts.get("operator1");
        if (da == null) return result;
        Instant now = Instant.now();

        String c1 = "conv_demo_001";
        AiChatMemoryEntity u1 = AiChatMemoryEntity.ofUser(c1, da.getId(), demo.getId(),
                "帮我查一下 DEV_001 设备的温度数据");
        u1.stampCreated(da.getId(), now.minus(30, ChronoUnit.MINUTES));
        result.add(aiChatMemoryRepository.save(u1));
        AiChatMemoryEntity a1 = AiChatMemoryEntity.ofAssistant(c1, da.getId(), demo.getId(),
                "DEV_001（CNC数控铣床-A01）当前温度为 28.5°C，处于正常范围。",
                "{\"action\":\"query\",\"resourceType\":\"data\",\"deviceId\":\"DEV_001\"}", "data");
        a1.stampCreated(TenantBaseEntity.SYSTEM_USER_ID, now.minus(29, ChronoUnit.MINUTES));
        result.add(aiChatMemoryRepository.save(a1));

        String c2 = "conv_demo_002";
        AiChatMemoryEntity u2 = AiChatMemoryEntity.ofUser(c2, da.getId(), demo.getId(),
                "今天有多少个活跃告警？");
        u2.stampCreated(da.getId(), now.minus(15, ChronoUnit.MINUTES));
        result.add(aiChatMemoryRepository.save(u2));
        AiChatMemoryEntity a2 = AiChatMemoryEntity.ofAssistant(c2, da.getId(), demo.getId(),
                "当前有 3 个活跃告警，2 个 WARNING，1 个 INFO。",
                "{\"action\":\"count\",\"resourceType\":\"alarm_event\"}", "alarm_event");
        a2.stampCreated(TenantBaseEntity.SYSTEM_USER_ID, now.minus(14, ChronoUnit.MINUTES));
        result.add(aiChatMemoryRepository.save(a2));

        if (o1 != null) {
            String c3 = "conv_demo_003";
            AiChatMemoryEntity u3 = AiChatMemoryEntity.ofUser(c3, o1.getId(), demo.getId(),
                    "帮我统计一下所有在线设备的数量");
            u3.stampCreated(o1.getId(), now.minus(60, ChronoUnit.MINUTES));
            result.add(aiChatMemoryRepository.save(u3));
            AiChatMemoryEntity a3 = AiChatMemoryEntity.ofAssistant(c3, o1.getId(), demo.getId(),
                    "当前共有 8 台在线设备，2 台离线。在线率 80%。",
                    "{\"action\":\"count\",\"resourceType\":\"device\"}", "device");
            a3.stampCreated(TenantBaseEntity.SYSTEM_USER_ID, now.minus(59, ChronoUnit.MINUTES));
            result.add(aiChatMemoryRepository.save(a3));
        }
        log.info("[数据播种] AI 对话记忆: {} 条", result.size());
        return result;
    }

    /**
     * 播种结果汇总
     */
    public record SeedResult(Map<String, TenantEntity> tenants,
                             Map<String, AccountEntity> accounts,
                             Map<String, NotifyUserEntity> notifyUsers,
                             List<NotifyTemplateEntity> templates,
                             List<DeviceEntity> devices,
                             List<PointEntity> points,
                             List<AlarmRuleEntity> alarmRules,
                             List<AlarmLogEntity> alarmLogs,
                             List<ControlRecordEntity> controlRecords,
                             List<DeviceScheduleEntity> schedules,
                             List<DevicePanelEntity> panels,
                             List<NotifyRecordEntity> notifyRecords,
                             List<DataEntity> historyData,
                             List<DeviceTemplateEntity> deviceTemplates,
                             List<ReportDefinitionEntity> reportDefinitions,
                             List<AiUserProfileEntity> aiProfiles,
                             List<AiChatMemoryEntity> aiMemories) {
    }
}

