package com.vex.iot.app.seed;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * 演示数据播种配置。
 *
 * <p>由 {@link DataSeedRunner} 在应用启动时使用；{@code enabled=false}（默认）时
 * Runner 不会被创建，播种逻辑完全不执行。
 */
@Getter
@Setter
@ConfigurationProperties(prefix = "vex.data-seed")
public class DataSeedProperties {

    /**
     * 显式开关；true 时应用启动完成后自动播种演示数据。
     * 生产环境务必保持 false。
     */
    private boolean enabled = false;

    /**
     * 强制播种：库中已存在设备数据时仍继续播种。
     * <p>false（默认）时若已存在设备则跳过，避免每次重启产生重复的告警规则 / 历史数据。
     */
    private boolean force = false;

    /**
     * 播种设备数量（上限 10，受内置车间/产线标签表限制）。
     */
    private int deviceCount = 10;

    /**
     * 历史数据天数。
     */
    private int historyDays = 30;

    /**
     * 所有种子账号的统一明文密码。
     */
    private String password = "12345678";
}
