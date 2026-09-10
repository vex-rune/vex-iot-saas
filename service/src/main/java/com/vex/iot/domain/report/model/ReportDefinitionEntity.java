package com.vex.iot.domain.report.model;

import com.vex.iot.common.model.SnowflakeId;
import com.vex.iot.common.model.TenantBaseEntity;
import jakarta.persistence.*;
import jakarta.validation.constraints.Size;
import lombok.*;
import lombok.experimental.SuperBuilder;

/// 报表定义
/// 存储自定义报表的查询配置（schemaJson），按租户隔离。
@EqualsAndHashCode(callSuper = true)
@Data
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "report_definition")
public class ReportDefinitionEntity extends TenantBaseEntity {

    /// 报表定义 ID（雪花算法生成）
    @Id
    @SnowflakeId
    private String id;

    /// 报表名称
    @Size(max = 64)
    @Column(length = 64)
    private String name;

    /// 报表描述
    @Size(max = 512)
    @Column(length = 512)
    private String description;

    /// 查询 schema JSON（三段式结构）
    @Size(max = 65536)
    @Column(name = "schema_json", columnDefinition = "TEXT")
    private String schemaJson;

    /// 是否启用
    @Builder.Default
    private boolean enabled = true;
}
