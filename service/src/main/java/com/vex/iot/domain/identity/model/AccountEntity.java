package com.vex.iot.domain.identity.model;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.vex.iot.common.model.BaseEntity;
import com.vex.iot.common.model.SnowflakeId;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.validation.constraints.Size;
import lombok.*;
import lombok.experimental.SuperBuilder;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.Instant;
import java.util.HashSet;
import java.util.Set;

/// 系统用户模型
/// 继承 BaseEntity 统一审计字段与软删除标记
@Getter
@Setter
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "sys_account")
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
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "roles", columnDefinition = "jsonb")
    @Builder.Default
    private Set<String> roles = new HashSet<>();

    /// 是否启用
    @Builder.Default
    private boolean enabled = true;

    /// 最后登录时间
    private Instant lastLoginAt;

    public void setPasswordHash(String hash) {
        this.passwordHash = hash;
    }

    public void setSalt(String salt) {
        this.salt = salt;
    }
}
