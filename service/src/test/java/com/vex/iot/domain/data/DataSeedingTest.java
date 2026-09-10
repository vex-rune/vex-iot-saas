package com.vex.iot.domain.data;

import com.vex.iot.IotSaasApplication;
import com.vex.iot.app.seed.DataSeedProperties;
import com.vex.iot.app.seed.DataSeedService;
import com.vex.iot.domain.device.enums.DataType;
import com.vex.iot.domain.device.model.DataEntity;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;

/**
 * 全系统数据播种集成测试 — 通过 {@link DataSeedService} 向数据库写入完整的演示数据。
 *
 * <p>播种逻辑已迁移到主源码（{@code com.vex.iot.app.seed}），
 * 应用启动时可通过 {@code vex.data-seed.enabled=true} 自动执行；
 * 本测试保留手动触发入口，方便按需向 dev 库灌入演示数据。
 *
 * <p>所有账号的明文密码均为 {@code 12345678}（SHA-256 + 16 字节随机盐）。
 */
@SpringBootTest(classes = IotSaasApplication.class)
@ActiveProfiles("test")
class DataSeedingTest {

    private static final int DEVICE_COUNT = 10;
    private static final int DAYS_OF_HISTORY = 30;

    @Autowired
    private DataSeedService dataSeedService;

    @Test
    void testSeedFullSystemData() throws InterruptedException {
        DataSeedProperties props = new DataSeedProperties();
        props.setEnabled(true);
        // 测试场景显式强制播种，忽略库中已有数据
        props.setForce(true);
        props.setDeviceCount(DEVICE_COUNT);
        props.setHistoryDays(DAYS_OF_HISTORY);

        DataSeedService.SeedResult result = dataSeedService.seedFullSystemData(props);

        assertNotNull(result, "force=true 时必须执行播种");
        assertFalse(result.tenants().isEmpty(), "租户应被创建");
        assertFalse(result.accounts().isEmpty(), "账号应被创建");
        assertFalse(result.devices().isEmpty(), "设备应被创建");
        assertFalse(result.points().isEmpty(), "点位应被创建");
        assertFalse(result.historyData().isEmpty(), "历史数据应被创建");

        // 等待异步事件（DataUpdateEvent → 告警判定 / SSE 推送）处理完成
        Thread.sleep(3000);

        printStatistics(result);
    }

    private void printStatistics(DataSeedService.SeedResult result) {
        System.out.println("\n========================================");
        System.out.println("  IoT SaaS 种子数据播种统计");
        System.out.println("========================================");

        System.out.println("\n【1. 租户】");
        result.tenants().forEach((code, t) -> System.out.printf("  %-10s | id=%s | name=%-15s | enabled=%s%n",
                code, t.getId(), t.getName(), t.isEnabled()));

        System.out.println("\n【2. 账号】（统一密码: 12345678）");
        result.accounts().forEach((uname, acc) -> System.out.printf("  %-15s | displayName=%-15s | roles=%s%n",
                uname, acc.getDisplayName(), acc.getRoles()));

        System.out.println("\n【3. 通知用户】");
        result.notifyUsers().forEach((name, u) ->
                System.out.printf("  %-5s | phone=%s | dept=%-6s | sms=%s | wechat=%s%n",
                        name, u.getPhone(), u.getDepartment(), u.isSmsEnabled(), u.isWechatEnabled()));

        System.out.println("\n【4. 通知模板】");
        result.templates().forEach(t -> System.out.printf("  %-20s | type=%-6s | platform=%-8s | enabled=%s%n",
                t.getName(), t.getType(), t.getPlatform(), t.isEnabled()));

        System.out.println("\n【5. 设备】总数: " + result.devices().size());

        System.out.println("\n【6. 点位】总数: " + result.points().size());
        for (DataType type : DataType.values()) {
            long count = result.points().stream().filter(p -> p.getDataType() == type).count();
            if (count > 0) System.out.printf("    %s: %d 个%n", type.name(), count);
        }

        System.out.println("\n【7. 告警规则】总数: " + result.alarmRules().size());
        result.alarmRules().forEach(r ->
                System.out.printf("    [%s] %s | device=%s/%s | threshold=%s | level=%s | enabled=%s%n",
                        r.getConditionType(), r.getRuleName(), r.getDeviceId(), r.getPointCode(),
                        r.getThreshold(), r.getLevel(), r.getEnabled()));

        System.out.println("\n【8. 告警事件】总数: " + result.alarmLogs().size());
        System.out.println("\n【9. 控制记录】总数: " + result.controlRecords().size());

        System.out.println("\n【10. 定时规则】");
        result.schedules().forEach(s -> System.out.printf("    [%s] device=%s | cron=%s | enabled=%s | actions=%d%n",
                s.getName(), s.getDeviceId(), s.getCron(), s.getEnabled(),
                s.getActions() == null ? 0 : s.getActions().size()));

        System.out.println("\n【11. 设备面板】");
        result.panels().forEach(p -> System.out.printf("    device=%s | widgets=%d%n",
                p.getDeviceId(),
                p.getPanelConfig() == null || p.getPanelConfig().get("widgets") == null ? 0
                        : ((List<?>) p.getPanelConfig().get("widgets")).size()));

        System.out.println("\n【12. 通知发送记录】总数: " + result.notifyRecords().size());

        List<DataEntity> historyData = result.historyData();
        System.out.println("\n【13. 历史数据】总条数: " + historyData.size());
        if (!historyData.isEmpty()) {
            Instant minTime = historyData.stream().map(DataEntity::getTimestamp).min(Instant::compareTo).orElseThrow();
            Instant maxTime = historyData.stream().map(DataEntity::getTimestamp).max(Instant::compareTo).orElseThrow();
            System.out.println("  时间范围: " + minTime + " ~ " + maxTime);
            System.out.printf("  平均数据间隔: %.1f 分钟%n",
                    (double) ChronoUnit.MINUTES.between(minTime, maxTime) / Math.max(1, historyData.size()));

            System.out.println("\n--- 前 5 条历史数据样本 ---");
            historyData.stream().limit(5).forEach(d ->
                    System.out.printf("  [%s] %s/%s = %s%n",
                            d.getTimestamp(), d.getDeviceName(), d.getPointName(), formatValue(d)));
        }

        System.out.println("\n【14. 设备模版】总数: " + result.deviceTemplates().size());
        result.deviceTemplates().forEach(t ->
                System.out.printf("    %s | %s | gw=%s | enabled=%s%n",
                        t.getTemplateName(), t.getDescription(), t.getGatewayType(), t.isEnabled()));

        System.out.println("\n【15. 报表定义】总数: " + result.reportDefinitions().size());
        result.reportDefinitions().forEach(r ->
                System.out.printf("    %s | %s | enabled=%s%n",
                        r.getName(), r.getDescription(), r.isEnabled()));

        System.out.println("\n【16. AI 用户画像】总数: " + result.aiProfiles().size());
        result.aiProfiles().forEach(p ->
                System.out.printf("    userId=%s | totalChats=%d | resources=%s%n",
                        p.getUserId(), p.getTotalChats(), p.getResourceUsageStats()));

        System.out.println("\n【17. AI 对话记忆】总数: " + result.aiMemories().size());

        System.out.println("\n========================================");
        System.out.println("  播种完成");
        System.out.println("========================================\n");
    }

    private String formatValue(DataEntity data) {
        if (data.getIntValue() != null)
            return data.getDataType() == DataType.BOOL
                    ? (data.getIntValue() == 1 ? "运行" : "停机")
                    : String.valueOf(data.getIntValue());
        if (data.getDoubleValue() != null) return String.valueOf(data.getDoubleValue());
        if (data.getStringValue() != null) return data.getStringValue();
        return "null";
    }
}
