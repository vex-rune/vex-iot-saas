package com.vex.iot.domain.ai.repository;

import com.vex.iot.domain.ai.model.AiChatMemoryEntity;
import org.springframework.data.domain.Limit;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.Instant;
import java.util.List;

/**
 * AI 对话记忆仓储。统一使用方法名派生查询。
 */
public interface AiChatMemoryRepository extends JpaRepository<AiChatMemoryEntity, String> {

    /**
     * 查询用户近期对话记忆（按时间倒序）。
     */
    List<AiChatMemoryEntity> findByUserIdAndExpiresAtAfterOrderByCreatedAtDesc(
            String userId, Instant now, Pageable pageable);

    /**
     * 查询会话的对话记忆（按时间正序，用于恢复上下文）。
     */
    List<AiChatMemoryEntity> findByConversationIdAndExpiresAtAfterOrderByCreatedAtAsc(
            String conversationId, Instant now);

    /**
     * 清理过期记忆。
     */
    int deleteByExpiresAtBefore(Instant now);

    List<AiChatMemoryEntity> queryTopByconversationId(String conversationId, Limit limit);
}
