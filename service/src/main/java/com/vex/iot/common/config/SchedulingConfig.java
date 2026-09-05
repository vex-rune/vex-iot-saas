package com.vex.iot.common.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.concurrent.ThreadPoolTaskScheduler;

/**
 * 定时任务调度配置。
 * <p>为 {@code @Scheduled} 方法提供独立的命名线程池，避免使用 Spring 默认的单线程调度器。
 * <p>核心线程数 = 2：预热任务（1h）与扫描任务（10s）互不阻塞。
 */
@Configuration
public class SchedulingConfig {

    @Bean("scheduleTaskScheduler")
    public ThreadPoolTaskScheduler scheduleTaskScheduler() {
        ThreadPoolTaskScheduler scheduler = new ThreadPoolTaskScheduler();
        scheduler.setPoolSize(2);
        scheduler.setThreadNamePrefix("iot-schedule-");
        scheduler.setWaitForTasksToCompleteOnShutdown(true);
        scheduler.setAwaitTerminationSeconds(30);
        scheduler.setErrorHandler(t -> {
            // 兜底：防止 @Scheduled 方法内未捕获的异常导致任务静默终止
            // 正常情况下各方法内部已自行 try-catch，此处仅做最后防线
        });
        scheduler.initialize();
        return scheduler;
    }
}