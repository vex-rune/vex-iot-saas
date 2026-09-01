package com.vex.iot.domain.identity.model;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.vex.iot.common.model.BaseEntity;
import com.vex.iot.common.model.SnowflakeId;
import jakarta.persistence.CollectionTable;
import jakarta.persistence.Column;
import jakarta.persistence.ElementCollection;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.Table;
import jakarta.validation.constraints.Size;
import lombok.*;
import lombok.experimental.SuperBuilder;

import java.time.LocalDateTime;
import java.util.HashSet;
import java.util.Set;

/// 系统用户模型
/// 继承 BaseEntity 统一审计字段与软删除标记
@Getter
@Setter
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
@EqualsAndHashCode(callSuper = false)
@Entity
@Table(name = "sys_user")
public class AccountEntity extends BaseEntity {

    /// 用户ID（雪花算法生成）
    @Id
    @SnowflakeId
    private String id;

    /// 用户名（唯一）
    @Size(max = 64)
    @Column(nullable = false, length = 64)
    private String username;

    /// 密码摘要
    /// SHA-256(salt + password) 的小写十六进制
    @Setter(AccessLevel.NONE)
    @JsonIgnore
    @Size(max = 128)
    @Column(length = 128)
    private String passwordHash;

    /// 密码盐值
    /// 16 字节随机盐,十六进制串
    @Setter(AccessLevel.NONE)
    @JsonIgnore
    @Size(max = 128)
    @Column(length = 128)
    private String salt;

    /// 显示名称
    @Size(max = 128)
    @Column(length = 128)
    private String displayName;

    /// 角色集合
    @Column(name = "roles", length = 64, columnDefinition = "TEXT")
    @Builder.Default
    private Set<String> roles = new HashSet<>();

    /// 是否启用
    @Builder.Default
    private boolean enabled = true;

    /// 最后登录时间
    private LocalDateTime lastLoginAt;

    public void setPasswordHash(String hash) {
        this.passwordHash = hash;
    }

    public void setSalt(String salt) {
        this.salt = salt;
    }
}
