package com.vex.iot.domain.ai.model;

import com.vex.iot.common.model.SnowflakeId;
import com.vex.iot.common.model.TenantBaseEntity;
import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.SuperBuilder;

import java.time.Instant;

/**
 * AI 对话记忆 — 按 conversationId 聚合，24h 自动过期。
 *
 * <p>每条记录对应一轮对话中的单条消息（user 或 assistant）。
 */
@EqualsAndHashCode(callSuper = true)
@Data
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "ai_chat_memory", indexes = {
        @Index(name = "idx_ai_chat_memory_user_time", columnList = "userId, createdAt"),
        @Index(name = "idx_ai_chat_memory_conversation", columnList = "conversationId, createdAt"),
        @Index(name = "idx_ai_chat_memory_expires", columnList = "expiresAt")
})
public class AiChatMemoryEntity extends TenantBaseEntity {

    @Id
    @SnowflakeId
    private String id;

    /// 会话ID（前端生成，同一次对话共享）
    @Setter(AccessLevel.NONE)
    @Column(length = 64)
    private String conversationId;

    /// 用户ID
    @Setter(AccessLevel.NONE)
    @Column(length = 64)
    private String userId;

    /// 角色：user / assistant
    @Column(length = 16)
    private String role;

    /// 原始消息内容
    @Column(columnDefinition = "text")
    private String content;

    /// AI 解析出的意图摘要（JSON 片段）
    @Column(columnDefinition = "text")
    private String intentSummary;

    /// 查询的资源类型（device / point / data / alarm_rule / alarm_event）
    @Column(length = 32)
    private String resourceType;

    /// 过期时间（createdAt + 24h）
    private Instant expiresAt;

    /**
     * 工厂方法：创建用户消息。
     */
    public static AiChatMemoryEntity ofUser(String conversationId, String userId,
                                            String tenantId, String content) {
        AiChatMemoryEntity entity = new AiChatMemoryEntity();
        entity.conversationId = conversationId;
        entity.userId = userId;
        entity.role = "user";
        entity.content = content;
        entity.setTenantId(tenantId);
        entity.stampCreated(userId, Instant.now());
        entity.expiresAt = Instant.now().plusSeconds(24 * 3600);
        return entity;
    }

    /**
     * 工厂方法：创建助手回复。
     */
    public static AiChatMemoryEntity ofAssistant(String conversationId, String userId,
                                                 String tenantId, String content,
                                                 String intentSummary, String resourceType) {
        AiChatMemoryEntity entity = new AiChatMemoryEntity();
        entity.conversationId = conversationId;
        entity.userId = userId;
        entity.role = "assistant";
        entity.content = content;
        entity.intentSummary = intentSummary;
        entity.resourceType = resourceType;
        entity.setTenantId(tenantId);
        entity.stampCreated(TenantBaseEntity.SYSTEM_USER_ID, Instant.now());
        entity.expiresAt = Instant.now().plusSeconds(24 * 3600);
        return entity;
    }
}
