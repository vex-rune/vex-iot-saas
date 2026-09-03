package com.vex.iot.domain.notify;

import com.vex.iot.common.enums.NotifyChannelType;

import java.time.Instant;
import java.util.List;

/// 发送通知的入参 — 由上游 (AlarmApp / NotifyApp / HTTP API 等) 显式声明"发什么 + 给谁"，
/// 由 {@link NotifyService#sendNotify(SendNotifyRequest)} 负责：选通道、落记录、真正发送、更新状态。
///
/// <p>字段语义：
/// <ul>
///   <li>{@code tenantId} — 租户 ID（可选；缺省用 {@code BaseEntity.DEFAULT_TENANT_ID}）；</li>
///   <li>{@code userIds} — 通知目标用户 ID 列表（必填，空即跳过）；</li>
///   <li>{@code channel} — 指定渠道（可选；缺省时按 {@code NotifyUserEntity} 的
///       {@code smsEnabled / wechatEnabled} 字段自动选择）；</li>
///   <li>{@code event} — 事件描述，写入 {@link com.vex.iot.domain.notify.model.NotifyRecordEntity#getEvent()}；</li>
///   <li>{@code content} — 实际发送给用户的内容（短信文案 / 微信文本）；</li>
///   <li>{@code trigger} — 触发者身份（报警引擎用 {@code CurrentUser.ofDevice(...)}），由 channel 端用于署名；</li>
///   <li>{@code params} — 模板参数 JSON（暂未启用，预留）；</li>
///   <li>{@code time} — 通知发生时间（缺省 = {@code now}）。</li>
/// </ul>
///
/// @author Vex
/// @since 1.0
public record SendNotifyRequest(
        String tenantId,
        List<String> userIds,
        NotifyChannelType channel,
        String event,
        String content,
        String params,
        Instant time
) {

    /// 校验：userIds 非空、content 非空；其余字段均可为 null（在 {@link NotifyService} 内补默认）
    public boolean isValid() {
        return userIds != null && !userIds.isEmpty() && content != null && !content.isBlank();
    }
}