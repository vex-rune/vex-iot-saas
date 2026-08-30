package com.vex.iot.domain.notify.model;

import com.vex.iot.common.model.BaseEntity;
import com.vex.iot.common.model.SnowflakeId;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.NoArgsConstructor;
import lombok.experimental.SuperBuilder;

/// 通知用户
/// 记录报警通知用户信息，包括联系方式、通知渠道等
@Data
@EqualsAndHashCode(callSuper = false)
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "notify_user")
public class NotifyUserEntity extends BaseEntity {

    /// 通知用户ID（雪花算法生成）
    @Id
    @SnowflakeId
    private String id;

    /// 姓名
    @Size(max = 64)
    @Column(length = 64)
    private String name;

    /// 手机号
    @Size(max = 20)
    @Column(length = 20)
    private String phone;

    /// 微信OpenID(预留,二期启用)
    @Size(max = 64)
    @Column(length = 64)
    private String wechatOpenId;

    /// 部门(预留,二期启用)
    @Size(max = 128)
    @Column(length = 128)
    private String department;

    /// 是否启用短信通知
    private boolean smsEnabled;

    /// 是否启用微信通知(预留,二期启用)
    private boolean wechatEnabled;

    /// 总通知开关:true 接收通知,false 一律不接收
    private boolean enabled;
}
