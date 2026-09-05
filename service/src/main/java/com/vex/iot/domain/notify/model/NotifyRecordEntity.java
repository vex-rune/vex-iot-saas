package com.vex.iot.domain.notify.model;

import com.vex.iot.domain.notify.enums.NotifyChannelType;
import com.vex.iot.domain.notify.enums.NotifyRecordStatus;
import com.vex.iot.common.model.SnowflakeId;
import com.vex.iot.common.model.TenantBaseEntity;
import jakarta.persistence.*;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.NoArgsConstructor;
import lombok.experimental.SuperBuilder;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.Instant;
import java.util.List;

/// 通知记录
/// 每次通知发送的结果存档(成功/失败/发送中)
@EqualsAndHashCode(callSuper = true)
@Data
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "notify_record")
public class NotifyRecordEntity extends TenantBaseEntity {

    /// 记录ID(雪花算法生成)
    @Id
    @SnowflakeId
    private String id;

    /// 通知发送时间
    private Instant time;

    /// 触发事件描述,如 "设备 a11 温度过高告警"
    @Size(max = 256)
    @Column(length = 256)
    private String event;

    /// 通知人 ID 列表
    ///
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb")
    private List<String> notifyUserIds;

    /// 通知渠道

    @Column(length = 16)
    private NotifyChannelType channel;

    /// 发送状态

    @Column(length = 64)
    private NotifyRecordStatus status;

    /// 实际发送内容(脱敏/截断后)
    @Size(max = 4000)
    @Column(columnDefinition = "TEXT")
    private String content;

    /// 参数列表 Map json
    @Size(max = 4000)
    @Column(columnDefinition = "TEXT")
    private String params;

    /// 失败时的错误信息
    @Size(max = 512)
    @Column(length = 512)
    private String error;
}
