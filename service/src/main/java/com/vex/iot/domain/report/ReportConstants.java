package com.vex.iot.domain.report;

/// 报表模块常量定义
/// 所有魔法数字、正则、限制值集中管理
public final class ReportConstants {

    // ─── Schema 版本 ──────────────────────────────────────────
    public static final String SCHEMA_VERSION_1_0 = "1.0";
    /// 执行最大行数
    public static final int MAX_EXECUTION_LIMIT = 5000;

    // ─── 执行限制 ──────────────────────────────────────────────
    /// 预览最大行数
    public static final int PREVIEW_LIMIT = 100;
    /// 列数上限
    public static final int MAX_COLUMNS = 20;

    // ─── Schema 校验 ──────────────────────────────────────────
    /// Schema JSON 最大字节数 (64KB)
    public static final int MAX_SCHEMA_BYTES = 65536;
    /// 名称最大长度
    public static final int MAX_NAME_LENGTH = 64;

    // ─── 报表定义 ──────────────────────────────────────────────
    /// 名称正则：中文/英文/数字/下划线/空格/横线
    public static final String NAME_REGEX =
            "^[A-Za-z0-9_\\u4e00-\\u9fa5][A-Za-z0-9_\\s\\u4e00-\\u9fa5\\-]{0,63}$";
    private ReportConstants() {
    }
}