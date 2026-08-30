package com.vex.iot.domain.notify.model;

import com.vex.iot.common.enums.NotifyTemplatePlatform;
import com.vex.iot.common.enums.NotifyTemplateType;
import com.vex.iot.common.model.BaseEntity;
import com.vex.iot.common.model.SnowflakeId;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.NoArgsConstructor;
import lombok.experimental.SuperBuilder;

/// 通知模版
/// 存储各类通知渠道(短信/微信/邮件)的三方平台模版配置
@Data
@EqualsAndHashCode(callSuper = false)
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "notify_template")
public class NotifyTemplateEntity extends BaseEntity {

    /// 模版ID(雪花算法生成)
    @Id
    @SnowflakeId
    private String id;

    /// 模版名称(前端展示)
    @Size(max = 64)
    @Column(length = 64)
    private String name;

    /// 通知类型
    @Enumerated(EnumType.STRING)
    @Column(length = 16)
    private NotifyTemplateType type;

    /// 对接平台
    @Enumerated(EnumType.STRING)
    @Column(length = 16)
    private NotifyTemplatePlatform platform;

    /// 三方平台上的模版 ID
    @Size(max = 64)
    @Column(length = 64)
    private String templateId;

    /// 内容示例,支持 ${var} 占位符
    @Size(max = 500)
    @Column(length = 500)
    private String contentExample;

    /// 启用开关
    private boolean enabled;
}
