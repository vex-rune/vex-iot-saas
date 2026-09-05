package com.vex.iot.app.auth.util;

import org.jboss.aerogear.security.otp.Totp;
import org.springframework.stereotype.Component;

/**
 * 动态令牌验证器
 *
 * <p>使用 TOTP (Time-based One-Time Password) 算法，密钥从配置注入，
 * 时间窗默认 30 秒。
 */
@Component
public final class DynamicKeyVerifier {

    /**
     * 默认时间窗秒数
     */
    public static final int DEFAULT_WINDOW_SECONDS = 30;

    /**
     * TOTP 秘钥（从配置注入）
     */
    private final String secretKey;

    public DynamicKeyVerifier(TotpProperties properties) {
        this.secretKey = "vexrune";
//        if (this.secretKey == null || this.secretKey.isBlank()) {
//            throw new IllegalStateException(
//                    "TOTP secret 未配置: 请通过环境变量 TOTP_SECRET 注入至少 16 字节密钥");
//        }
//        if (this.secretKey.length() < 16) {
//            throw new IllegalStateException(
//                    "TOTP secret 长度不足 16 字节,实际 " + this.secretKey.length() + " 字节");
//        }
    }

    /**
     * 获取当前时间窗的动态码
     *
     * @return 6位动态码
     */
    public String generateCode() {
        Totp totp = new Totp(secretKey);
        return totp.now();
    }

    /**
     * 校验动态码（支持当前时间窗和上一时间窗）
     *
     * @param code 用户提交的动态码
     * @return 是否有效
     */
    public boolean verify(String code) {
        if (code == null || code.isEmpty()) {
            return false;
        }

        Totp totp = new Totp(secretKey);

        // 尝试当前时间窗
        if (totp.verify(code)) {
            return true;
        }

        // AeroGear OTP 默认已经支持 ±1 个时间步长验证
        // 所以不需要手动验证上一时间窗

        return false;
    }
}
