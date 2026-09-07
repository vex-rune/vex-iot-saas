package com.vex.iot.app.seed;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.stereotype.Component;

/**
 * 演示数据播种开关入口。
 *
 * <p>启用条件：{@code vex.data-seed.enabled=true}。未开启时该 Bean 不会被创建，
 * 播种逻辑与生产运行完全隔离。
 *
 * <p>启动方式示例：
 * <pre>
 * java -jar iot-saas.jar --vex.data-seed.enabled=true
 * # 或环境变量
 * DATA_SEED_ENABLED=true
 * </pre>
 */
@Slf4j
@Component
@RequiredArgsConstructor
@EnableConfigurationProperties(DataSeedProperties.class)
@ConditionalOnProperty(prefix = "vex.data-seed", name = "enabled", havingValue = "true")
public class DataSeedRunner implements ApplicationRunner {

    private final DataSeedProperties props;
    private final DataSeedService dataSeedService;

    @Override
    public void run(ApplicationArguments args) {
        try {
            DataSeedService.SeedResult result = dataSeedService.seedFullSystemData(props);
            if (result == null) {
                log.info("[数据播种] 已存在设备数据，跳过播种（如需强制播种请设置 vex.data-seed.force=true）");
            }
        } catch (Exception e) {
            // 播种失败不应阻断应用启动
            log.error("[数据播种] 播种失败: {}", e.getMessage(), e);
        }
    }
}
