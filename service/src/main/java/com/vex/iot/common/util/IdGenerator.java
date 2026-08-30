package com.vex.iot.common.util;

/**
 * ID 生成器。
 *
 * <p>历史方法 {@link #objectId()} 保留以兼容旧调用;
 * 新增的 {@link #snowId()} / {@link #snowId(String)} 用于 JPA 实体雪花主键。
 */
public final class IdGenerator {
    private IdGenerator() {
    }

    /** Mongo ObjectId(24位 hex)。新代码请用 {@link #snowId()}。 */
    public static String objectId() {
        return cn.hutool.core.util.IdUtil.objectId();
    }

    /** 雪花 long。 */
    public static long snowflake() {
        return cn.hutool.core.util.IdUtil.getSnowflake(1L, 1L).nextId();
    }

    /** 雪花 long → String。 */
    public static String snowflakeStr() {
        return String.valueOf(snowflake());
    }

    /** 业务前缀 + 雪花号,形如 {@code "P_1820..."}"。 */
    public static String snowId() {
        return snowId("");
    }

    /**
     * 业务前缀 + 雪花号。前缀为空时返回纯雪花号。
     *
     * @param prefix 前缀,允许为空
     */
    public static String snowId(String prefix) {
        String id = snowflakeStr();
        return prefix == null || prefix.isEmpty() ? id : prefix + "_" + id;
    }
}