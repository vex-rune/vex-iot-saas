package com.vex.iot.domain.device.model;

import com.vex.iot.common.model.SnowflakeId;
import com.vex.iot.common.model.TenantBaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.NoArgsConstructor;
import lombok.experimental.SuperBuilder;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.util.Map;

/**
 * 设备面板配置实体。
 *
 * <p>每个设备一条记录，存储前端面板的 JSON 配置（widgets 布局 + 绑定 + 插件参数）。
 *
 * <p>{@link #panelConfig} 是 {@code Map<String, Object>},由 Hibernate 6 的
 * {@link SqlTypes#JSON} 自动序列化为 PostgreSQL {@code JSONB} 列;
 * 后端不解析内部结构,仅做持久化与转发。
 */
@EqualsAndHashCode(callSuper = true)
@Data
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "device_panel")
public class DevicePanelEntity extends TenantBaseEntity {

    /// 面板配置主键
    @Id
    @SnowflakeId
    private String id;

    /// 关联设备 ID
    @NotBlank
    @Size(max = 64)
    @Column(name = "device_id", length = 64, nullable = false, unique = true)
    private String deviceId;

    /**
     * 面板配置(JSON 对象)。
     *
     * <p>Java 侧以 {@code Map<String, Object>} 承载;DB 侧存为 PostgreSQL {@code JSONB}。
     *
     * <p>格式示例:
     * <pre>{@code
     * {
     *   "version": 1,
     *   "widgets": [
     *     {
     *       "id": "w_xxx",
     *       "title": "温度",
     *       "layout": { "x": 0, "y": 0, "w": 3, "h": 3 },
     *       "binding": { "kind": "point", "pointCode": "temp" },
     *       "plugin": "metric-value",
     *       "source": "realtime",
     *       "props": { "showUnit": true }
     *     }
     *   ]
     * }
     * }</pre>
     */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "panel_config", columnDefinition = "jsonb")
    private Map<String, Object> panelConfig;
}