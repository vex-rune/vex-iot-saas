package com.vex.iot.app.seed;

import com.vex.iot.common.constants.RoleConstants;
import com.vex.iot.common.model.TenantBaseEntity;
import com.vex.iot.common.security.PasswordHasher;
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
import com.vex.iot.domain.device.enums.AccessType;
import com.vex.iot.domain.device.enums.DataType;
import com.vex.iot.domain.device.enums.DeviceOnline;
import com.vex.iot.domain.device.enums.OperationResult;
import com.vex.iot.domain.device.model.*;
import com.vex.iot.domain.device.repository.ControlRecordRepository;
import com.vex.iot.domain.device.repository.DevicePanelRepository;
import com.vex.iot.domain.device.repository.DeviceRepository;
import com.vex.iot.domain.device.repository.PointDefinitionRepository;
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
 * 通知记录 → 历史数据。
 *
 * <p>租户 / 账号 / 设备 / 点位 / 面板为幂等写入；告警规则、控制记录、定时规则、
 * 通知记录、历史数据为追加写入，因此默认仅在库中无设备时执行一次
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

    /**
     * 执行全系统数据播种。
     *
     * @param props 播种参数（设备数量、历史天数、统一密码、是否强制）
     * @return 播种结果；当库中已有设备且 {@code force=false} 时返回 {@code null} 表示已跳过
     */
    public SeedResult seedFullSystemData(DataSeedProperties props) {
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
        for (DeviceEntity device : devices) {
            allPoints.addAll(createPointsForDevice(device.getId(), device.getDeviceName(), device.getTenantId()));
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
        List<DevicePanelEntity> panels = seedDevicePanels(devices.subList(0, Math.min(2, devices.size())));

        // 10. 告警事件
        List<AlarmLogEntity> alarmLogs = seedAlarmLogs(alarmRules);

        // 11. 通知记录
        List<NotifyRecordEntity> notifyRecords = seedNotifyRecords(notifyUsers, alarmLogs);

        // 12. 历史数据
        List<DataEntity> allHistoryData = seedHistoryData(devices, allPoints, historyDays);

        log.info("[数据播种] 完成: 租户={} 账号={} 通知人={} 模板={} 设备={} 点位={} "
                        + "告警规则={} 告警事件={} 控制记录={} 定时规则={} 面板={} 通知记录={} 历史数据={}",
                tenants.size(), accounts.size(), notifyUsers.size(), templates.size(),
                devices.size(), allPoints.size(), alarmRules.size(), alarmLogs.size(),
                controlRecords.size(), schedules.size(), panels.size(), notifyRecords.size(),
                allHistoryData.size());

        return new SeedResult(tenants, accounts, notifyUsers, templates, devices, allPoints,
                alarmRules, alarmLogs, controlRecords, schedules, panels, notifyRecords, allHistoryData);
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
                {"赵六", "13800000004", "生产部", true, false, true, "prod"}
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
                        "SMS_001", "【IoT平台】设备${deviceName}触发${alarmLevel}报警：${message}", "demo"},
                {"故障短信-阿里云", NotifyTemplateType.SMS, NotifyTemplatePlatform.ALIYUN,
                        "SMS_002", "【IoT平台】设备${deviceName}发生故障，请及时处理", "demo"},
                {"微信通知", NotifyTemplateType.WECHAT, NotifyTemplatePlatform.OTHER,
                        "WX_001", "设备报警：${deviceName} - ${message}", "demo"},
                {"邮件通知-腾讯云", NotifyTemplateType.EMAIL, NotifyTemplatePlatform.TENCENT,
                        "EMAIL_001", "<h3>设备报警</h3><p>设备：${deviceName}</p><p>消息：${message}</p>", "prod"}
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

        String[][] plantMap = {
                {"车间A", "产线1", "工位1"}, {"车间A", "产线1", "工位2"},
                {"车间A", "产线2", "工位3"}, {"车间A", "产线2", "工位4"},
                {"车间A", "产线3", "工位5"}, {"车间A", "产线3", "工位6"},
                {"车间B", "产线1", "工位7"}, {"车间B", "产线2", "工位8"},
                {"车间B", "产线3", "工位9"}, {"车间B", "产线3", "工位10"}
        };

        for (int i = 1; i <= deviceCount; i++) {
            String deviceId = "DEV_" + String.format("%03d", i);

            // 幂等检查
            DeviceEntity existingDevice = deviceRepository.findById(deviceId).orElse(null);
            if (existingDevice != null) {
                devices.add(existingDevice);
                continue;
            }

            // 前 6 个设备分配到 demo，其余分配到 prod
            String tenantId = i <= 6 ? demo.getId() : prod.getId();
            DeviceOnline online = random.nextDouble() < 0.8 ? DeviceOnline.ONLINE : DeviceOnline.OFFLINE;
            DeviceEntity device = DeviceEntity.builder()
                    .id(deviceId)
                    .tenantId(tenantId)
                    .deviceName("设备-" + String.format("%03d", i))
                    .gatewayId("GW_" + String.format("%03d", (i - 1) / 5 + 1))
                    .enabled(true)
                    .online(online)
                    .level1Tag(plantMap[i - 1][0])
                    .level2Tag(plantMap[i - 1][1])
                    .level3Tag(plantMap[i - 1][2])
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
     * 为设备创建点位（温度 DOUBLE + 运行状态 BOOL），确定性 ID 保证幂等
     */
    private List<PointEntity> createPointsForDevice(String deviceId, String deviceName, String tenantId) {
        List<PointEntity> points = new ArrayList<>();

        String tempId = "PT_" + deviceId + "_TEMP";
        PointEntity existingTemp = pointDefinitionRepository.findById(tempId).orElse(null);
        if (existingTemp != null) {
            points.add(existingTemp);
        } else {
            PointEntity tempPoint = PointEntity.builder()
                    .id(tempId)
                    .tenantId(tenantId)
                    .deviceId(deviceId)
                    .pointCode("temperature")
                    .pointName(deviceName + "-温度")
                    .description("环境温度传感器")
                    .unit("°C")
                    .dataType(DataType.DOUBLE)
                    .access(AccessType.RO)
                    .sortOrder(1)
                    .precision(1)
                    .build();
            tempPoint.stampCreated(TenantBaseEntity.SYSTEM_USER_ID, Instant.now());
            points.add(pointDefinitionRepository.save(tempPoint));
        }

        String statusId = "PT_" + deviceId + "_STATUS";
        PointEntity existingStatus = pointDefinitionRepository.findById(statusId).orElse(null);
        if (existingStatus != null) {
            points.add(existingStatus);
        } else {
            PointEntity statusPoint = PointEntity.builder()
                    .id(statusId)
                    .tenantId(tenantId)
                    .deviceId(deviceId)
                    .pointCode("run_status")
                    .pointName(deviceName + "-运行状态")
                    .description("设备运行状态")
                    .unit(null)
                    .dataType(DataType.BOOL)
                    .access(AccessType.RW)
                    .sortOrder(2)
                    .valueMappings("{\"0\":\"停机\",\"1\":\"运行\"}")
                    .build();
            statusPoint.stampCreated(TenantBaseEntity.SYSTEM_USER_ID, Instant.now());
            points.add(pointDefinitionRepository.save(statusPoint));
        }

        return points;
    }

    // ==================== 6. 告警规则 ====================
    private List<AlarmRuleEntity> seedAlarmRules(List<DeviceEntity> devices, List<PointEntity> allPoints,
                                                 List<NotifyUserEntity> notifyUsers) {
        List<AlarmRuleEntity> result = new ArrayList<>();

        // 为前 3 个设备的温度 / 状态点位创建告警规则
        List<DeviceEntity> firstThree = devices.subList(0, Math.min(3, devices.size()));
        List<String> notifyIds = notifyUsers.stream().map(NotifyUserEntity::getId).limit(3).toList();

        for (DeviceEntity device : firstThree) {
            PointEntity tempPoint = findPoint(allPoints, device.getId(), "temperature");
            PointEntity statusPoint = findPoint(allPoints, device.getId(), "run_status");

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

        for (int i = 0; i < Math.min(5, devices.size()); i++) {
            DeviceEntity device = devices.get(i);
            PointEntity rwPoint = findPoint(allPoints, device.getId(), "run_status");
            if (rwPoint == null) continue;

            OperationResult status;
            String errorMessage = null;
            if (i < 3) status = OperationResult.SUCCESS;
            else if (i == 3) status = OperationResult.PENDING;
            else {
                status = OperationResult.FAIL;
                errorMessage = "设备无响应";
            }

            ControlRecordEntity record = ControlRecordEntity.builder()
                    .tenantId(device.getTenantId())
                    .deviceId(device.getId())
                    .deviceName(device.getDeviceName())
                    .pointCode(rwPoint.getPointCode())
                    .pointName(rwPoint.getPointName())
                    .inputValue("1")
                    .writtenValue("1")
                    .username(operator.getUsername())
                    .status(status)
                    .errorMessage(errorMessage)
                    .occurredAt(Instant.now().minus(random.nextInt(48), ChronoUnit.HOURS))
                    .writtenAt(status == OperationResult.SUCCESS
                            ? Instant.now().minus(random.nextInt(48), ChronoUnit.HOURS).plusSeconds(2)
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

        for (int i = 0; i < Math.min(3, devices.size()); i++) {
            DeviceEntity device = devices.get(i);
            PointEntity rwPoint = findPoint(allPoints, device.getId(), "run_status");
            if (rwPoint == null) continue;

            String cron;
            String value;
            String name;
            if (i == 0) {
                cron = "0 0 8 * * ?";
                value = "1";
                name = "每天8点开机";
            } else if (i == 1) {
                cron = "0 0 20 * * ?";
                value = "0";
                name = "每天20点关机";
            } else {
                cron = "0 0/30 * * * ?";
                value = "1";
                name = "每30分钟巡检";
            }

            ScheduleAction action = new ScheduleAction();
            action.setPointId(rwPoint.getId());
            action.setPointCode(rwPoint.getPointCode());
            action.setValueText(value);
            action.setSortOrder(1);

            DeviceScheduleEntity schedule = DeviceScheduleEntity.builder()
                    .tenantId(device.getTenantId())
                    .deviceId(device.getId())
                    .name(name)
                    .cron(cron)
                    .enabled(true)
                    .description("种子数据生成的定时规则 - " + cron)
                    .actions(new ArrayList<>(List.of(action)))
                    .build();
            schedule.stampCreated(TenantBaseEntity.SYSTEM_USER_ID, Instant.now());
            result.add(deviceScheduleRepository.save(schedule));
        }
        log.info("[数据播种] 定时规则: {} 条", result.size());
        return result;
    }

    // ==================== 9. 设备面板 ====================
    private List<DevicePanelEntity> seedDevicePanels(List<DeviceEntity> devices) {
        List<DevicePanelEntity> result = new ArrayList<>();

        for (DeviceEntity device : devices) {
            // 幂等检查：device_id 字段有唯一约束
            DevicePanelEntity existing = devicePanelRepository.findByDeviceId(device.getId()).orElse(null);
            if (existing != null) {
                result.add(existing);
                continue;
            }

            Map<String, Object> panelConfig = new LinkedHashMap<>();
            panelConfig.put("version", 1);

            List<Map<String, Object>> widgets = new ArrayList<>();

            Map<String, Object> tempWidget = new LinkedHashMap<>();
            tempWidget.put("id", "w_" + device.getId() + "_temp");
            tempWidget.put("title", "温度");
            tempWidget.put("layout", Map.of("x", 0, "y", 0, "w", 3, "h", 3));
            tempWidget.put("binding", Map.of("kind", "point", "pointCode", "temperature"));
            tempWidget.put("plugin", "metric-value");
            tempWidget.put("source", "realtime");
            tempWidget.put("props", Map.of("showUnit", true, "precision", 1));
            widgets.add(tempWidget);

            Map<String, Object> statusWidget = new LinkedHashMap<>();
            statusWidget.put("id", "w_" + device.getId() + "_status");
            statusWidget.put("title", "运行状态");
            statusWidget.put("layout", Map.of("x", 3, "y", 0, "w", 3, "h", 3));
            statusWidget.put("binding", Map.of("kind", "point", "pointCode", "run_status"));
            statusWidget.put("plugin", "status-indicator");
            statusWidget.put("source", "realtime");
            statusWidget.put("props", Map.of("showUnit", false));
            widgets.add(statusWidget);

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
     * 根据数据类型构建数据实体（有规律的值）
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
            case BOOL -> builder.intValue(random.nextDouble() < 0.8 ? 1L : 0L);
            case INT -> builder.intValue(20 + random.nextLong(61));
            case FLOAT -> {
                double v = 20.0 + random.nextDouble() * 15.5;
                builder.doubleValue(Math.round(v * 10.0) / 10.0);
            }
            case DOUBLE -> builder.doubleValue(1000.0 + random.nextDouble() * 50.0);
            case STRING -> {
                String[] s = {"running", "idle", "error", "warning"};
                builder.stringValue(s[random.nextInt(s.length)]);
            }
        }
        DataEntity entity = builder.build();
        entity.stampCreated(TenantBaseEntity.SYSTEM_USER_ID, Instant.now());
        return entity;
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
                             List<DataEntity> historyData) {
    }
}

