package com.vex.iot.common.config;

import com.github.benmanes.caffeine.cache.Caffeine;
import org.springframework.cache.CacheManager;
import org.springframework.cache.annotation.EnableCaching;
import org.springframework.cache.caffeine.CaffeineCacheManager;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.util.concurrent.TimeUnit;

/**
 * 缓存配置
 *
 * <p>使用 Caffeine 作为内存缓存，支持 TTL（过期时间）
 */
@Configuration
@EnableCaching
public class DeviceCacheConfig {

    /// 设备在线状态缓存
    public static final String DEVICE_ONLINE_STATUS = "device-online-status";

    /**
     * 缓存管理器 - Caffeine
     *
     * @return 缓存管理器
     */
    @Bean
    public CacheManager cacheManager() {
        CaffeineCacheManager cacheManager = new CaffeineCacheManager(DEVICE_ONLINE_STATUS);
        cacheManager.setCaffeine(Caffeine.newBuilder()
                // 写入后 30 秒过期
                .expireAfterWrite(30, TimeUnit.SECONDS)
                // 最多缓存 1000 条
                .maximumSize(10000)
                // 记录缓存命中率
                .recordStats());
        return cacheManager;
    }
}
