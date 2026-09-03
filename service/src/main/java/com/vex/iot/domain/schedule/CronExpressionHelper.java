package com.vex.iot.domain.schedule;

import org.springframework.scheduling.support.CronExpression;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

/**
 * Cron 表达式辅助
 * <p>使用 Spring 自带的 {@link CronExpression}，支持 5 段 / 6 段。
 */
public final class CronExpressionHelper {

    private CronExpressionHelper() {
    }

    public static void parse(String cron) {
        CronExpression.parse(cron);
    }

    /**
     * 计算 Cron 表达式在指定时间段内的所有执行时间点
     *
     * @param cron  Cron 表达式
     * @param start 起始时间（包含）
     * @param end   结束时间（不包含）
     * @return 执行时间点列表（按时间升序）
     */
    public static List<Instant> getNextFireTimes(String cron, Instant start, Instant end) {
        List<Instant> fireTimes = new ArrayList<>();
        CronExpression expression = CronExpression.parse(cron);

        Instant next = expression.next(start);
        while (next != null && next.isBefore(end)) {
            fireTimes.add(next);
            next = expression.next(next);
        }

        return fireTimes;
    }
}

