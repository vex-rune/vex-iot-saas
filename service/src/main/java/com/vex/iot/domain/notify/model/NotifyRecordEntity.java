package com.vex.iot.domain.notify.model;

import com.vex.iot.common.enums.NotifyChannelType;
import com.vex.iot.common.enums.NotifyRecordStatus;
import com.vex.iot.common.model.BaseEntity;
import com.vex.iot.common.model.SnowflakeId;
import jakarta.persistence.CollectionTable;
import jakarta.persistence.Column;
import jakarta.persistence.ElementCollection;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.Table;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.NoArgsConstructor;
import lombok.experimental.SuperBuilder;

import java.time.LocalDateTime;
import java.util.List;

/// 通知记录
/// 每次通知发送的结果存档(成功/失败/发送中)
@Data
@EqualsAndHashCode(callSuper = false)
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "notify_record")
public class NotifyRecordEntity extends BaseEntity {

    /// 记录ID(雪花算法生成)
    @Id
    @SnowflakeId
    private String id;

    /// 通知发送时间
    private LocalDateTime time;

    /// 触发事件描述,如 "设备 a11 温度过高告警"
    @Size(max = 256)
    @Column(length = 256)
    private String event;

    /// 通知人 ID 列表
    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "notify_record_user", joinColumns = @JoinColumn(name = "record_id"))
    @Column(name = "user_id", length = 64)
    private List<String> notifyUserIds;

    /// 通知渠道
    @Enumerated(EnumType.STRING)
    @Column(length = 16)
    private NotifyChannelType channel;

    /// 发送状态
    @Enumerated(EnumType.STRING)
    @Column(length = 16)
    private NotifyRecordStatus status;

    /// 实际发送内容(脱敏/截断后)
    @Size(max = 4000)
    @Column( columnDefinition = "TEXT")
    private String content;

    /// 失败时的错误信息
    @Size(max = 512)
    @Column(length = 512)
    private String error;
}
