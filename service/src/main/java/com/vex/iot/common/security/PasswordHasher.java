package com.vex.iot.common.security;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;

/**
 * 密码哈希工具:SHA-256(salt + plaintext) → 小写十六进制摘要。
 *
 * <p>盐为 16 字节随机串的十六进制,每个用户独立生成,数据库泄露后无法用彩虹表反推。
 */
public final class PasswordHasher {

    private static final SecureRandom RNG = new SecureRandom();
    private static final int SALT_BYTES = 16;

    private PasswordHasher() {
    }

    /**
     * 生成 16 字节随机盐(小写十六进制,32 字符)。
     */
    public static String generateSalt() {
        byte[] bytes = new byte[SALT_BYTES];
        RNG.nextBytes(bytes);
        return toHex(bytes);
    }

    /**
     * 计算密码摘要: SHA-256(salt + plaintext) → 小写十六进制。
     */
    public static String hash(String salt, String plaintext) {
        if (salt == null || salt.isBlank()) throw new IllegalArgumentException("salt 不能为空");
        if (plaintext == null) plaintext = "";
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            md.update(salt.getBytes(StandardCharsets.UTF_8));
            byte[] digest = md.digest(plaintext.getBytes(StandardCharsets.UTF_8));
            return toHex(digest);
        } catch (NoSuchAlgorithmException ex) {
            throw new IllegalStateException("SHA-256 不可用", ex);
        }
    }

    /**
     * 校验密码: 摘要等于用户已存摘要。
     */
    public static boolean verify(String salt, String plaintext, String expectedHash) {
        if (expectedHash == null) return false;
        return MessageDigest.isEqual(
                expectedHash.getBytes(StandardCharsets.UTF_8),
                hash(salt, plaintext).getBytes(StandardCharsets.UTF_8));
    }

    private static String toHex(byte[] bytes) {
        StringBuilder sb = new StringBuilder(bytes.length * 2);
        for (byte b : bytes) sb.append(String.format("%02x", b));
        return sb.toString();
    }
}
