package com.vex.iot.domain.auth.util;

import org.jboss.aerogear.security.otp.Totp;

/**
 * 动态令牌验证器
 *
 * <p>使用 TOTP (Time-based One-Time Password) 算法，
 * 固定秘钥为 vexrune，时间窗默认 30 秒。
 */
public final class DynamicKeyVerifier {

    /**
     * 固定秘钥
     */
    private static final String SECRET_KEY = "vexrune";

    /**
     * 默认时间窗秒数
     */
    public static final int DEFAULT_WINDOW_SECONDS = 30;

    private DynamicKeyVerifier() {
    }

    /**
     * 获取当前时间窗的动态码
     *
     * @return 6位动态码
     */
    public static String generateCode() {
        Totp totp = new Totp(SECRET_KEY);
        return totp.now();
    }

    /**
     * 校验动态码（支持当前时间窗和上一时间窗）
     *
     * @param code 用户提交的动态码
     * @return 是否有效
     */
    public static boolean verify(String code) {
        if (code == null || code.isEmpty()) {
            return false;
        }

        Totp totp = new Totp(SECRET_KEY);

        // 尝试当前时间窗
        if (totp.verify(code)) {
            return true;
        }

        // AeroGear OTP 默认已经支持 ±1 个时间步长验证
        // 所以不需要手动验证上一时间窗

        return false;
    }
}
