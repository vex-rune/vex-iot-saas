package com.vex.iot.domain.dashboard.model;

import com.vex.iot.common.enums.CardType;
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
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.util.List;

/// 仪表盘卡片
/// pointRefList引用PointDefinitionEntity.id集合，存储为json数组。
@Data
@EqualsAndHashCode(callSuper = false)
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "dashboard_card")
public class DashboardCardEntity extends BaseEntity {

    /// 卡片主键
    @Id
    @SnowflakeId
    private String id;

    /// 归属仪表盘ID
    @Size(max = 64)
    @Column(length = 64)
    private String dashboardId;

    /// 卡片标题
    @Size(max = 128)
    @Column(length = 128)
    private String cardTitle;

    /// 卡片类型
    @Enumerated(EnumType.STRING)
    private CardType cardType;

    /// 引用点位ID集合，存储PointDefinitionEntity.id
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "point_ref_list", columnDefinition = "jsonb")
    private List<String> pointRefList;

    /// true仅展示告警点位
    @Column(name = "filter_alarm_only")
    private Boolean filterAlarmOnly;

    /// 卡片最大展示条目数
    @Column(name = "max_show_count")
    private Integer maxShowCount;

    /// 内部排序字段 timestamp / pointName
    @Size(max = 32)
    @Column(name = "sort_field", length = 32)
    private String sortField;

    /// 卡片在dashboard中的顺序，数字越小越靠前
    @Column(name = "sort_order")
    private Integer sortOrder;

    /// UI布局JSON配置：占列数、时间范围、是否显示单位、配色等
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "layout_config", columnDefinition = "jsonb")
    private String layoutConfig;

    /// 卡片是否启用；false该卡片不渲染
    @Column(name = "enabled")
    private Boolean enabled;
}
