package com.vex.iot.domain.ai.model;

import com.vex.iot.common.model.SnowflakeId;
import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.experimental.SuperBuilder;

import java.time.Instant;

/**
 * AI 用户画像 — 持久化，反映用户使用习惯。
 *
 * <p>每用户每租户一条记录，随对话逐步丰富画像。
 */
@Data
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "ai_user_profile",
        uniqueConstraints = @UniqueConstraint(columnNames = {"userId", "tenantId"}))
public class AiUserProfileEntity {

    @Id
    @SnowflakeId
    private String id;

    /// 用户ID
    @Column(length = 64, nullable = false)
    private String userId;

    /// 租户ID
    @Column(length = 64, nullable = false)
    private String tenantId;

    /// 关注的设备ID列表（JSON array）
    @Column(columnDefinition = "text")
    private String favoriteDeviceIds;

    /// 常用资源类型（JSON: {"data":15,"device":8,"alarm_event":3}）
    @Column(columnDefinition = "text")
    private String resourceUsageStats;

    /// 常用操作类型（JSON: {"query":25,"count":1}）
    @Column(columnDefinition = "text")
    private String actionUsageStats;

    /// 总对话次数
    @Builder.Default
    private Integer totalChats = 0;

    /// 最后活跃时间
    private Instant lastActiveAt;

    /// 最后使用的查询偏好（JSON, 如默认排序/分页大小）
    @Column(columnDefinition = "text")
    private String queryPreferences;

    private Instant createdAt;
    private Instant updatedAt;

    /**
     * 创建新画像。
     */
    public static AiUserProfileEntity create(String userId, String tenantId) {
        AiUserProfileEntity profile = new AiUserProfileEntity();
        profile.userId = userId;
        profile.tenantId = tenantId;
        profile.totalChats = 0;
        profile.resourceUsageStats = "{}";
        profile.actionUsageStats = "{}";
        profile.favoriteDeviceIds = "[]";
        profile.queryPreferences = "{}";
        profile.createdAt = Instant.now();
        profile.updatedAt = Instant.now();
        return profile;
    }

    /**
     * 刷新最后活跃时间。
     */
    public void touch() {
        this.lastActiveAt = Instant.now();
        this.updatedAt = Instant.now();
    }
}
