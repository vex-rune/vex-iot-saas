package com.vex.iot.domain.audit.model;

import com.vex.iot.common.enums.OperationAction;
import com.vex.iot.common.enums.OperationResult;
import com.vex.iot.common.enums.ResourceType;
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

import java.time.LocalDateTime;

/// 操作日志
/// 操作审计日志:仅记录 PRD 明确要求的关键写操作(登录、控制下发)。
/// CRUD 后续按需扩展。
@Data
@EqualsAndHashCode(callSuper = false)
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "operation_log")
public class OperationLogEntity extends BaseEntity {

    /// 操作日志ID（雪花算法生成）
    @Id
    @SnowflakeId
    private String id;

    /// 操作人用户名
    @Size(max = 64)
    @Column(length = 64)
    private String username;

    /// 操作类型（LOGIN / CONTROL / 其他）
    @Enumerated(EnumType.STRING)
    private OperationAction action;

    /// 资源类型（device/point）
    @Enumerated(EnumType.STRING)
    private ResourceType resourceType;

    /// 资源ID（deviceId）
    @Size(max = 64)
    @Column(length = 64)
    private String resourceId;

    /// 详情（JSON 字符串:成功/失败/参数摘要）
    @Size(max = 4096)
    @Column(name = "detail", columnDefinition = "TEXT")
    private String detail;

    /// 状态（SUCCESS / FAIL）
    @Enumerated(EnumType.STRING)
    private OperationResult status;

    /// 错误消息
    @Size(max = 512)
    @Column(length = 512)
    private String errorMessage;

    /// 发生时间
    private LocalDateTime occurredAt;
}
