package com.vex.iot.domain.schedule.model;

import com.vex.iot.common.model.SnowflakeId;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.experimental.SuperBuilder;

/**
 * 设备定时控制规则的动作
 * <p>一条规则可包含多个动作；触发时按 {@link #sortOrder} 顺序执行。
 * <p>值统一以字符串保存，触发时按点位 {@code dataType} 转换。
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@SuperBuilder
@Entity
@Table(name = "device_schedule_action")
public class DeviceScheduleActionEntity {

    /** 动作ID（雪花算法生成） */
    @Id
    @SnowflakeId
    private String id;

    /** 所属规则ID */
    @Size(max = 64)
    @Column(name = "schedule_id", length = 64)
    private String scheduleId;

    /** 目标点位ID（便于直接定位） */
    @Size(max = 64)
    @Column(name = "point_id", length = 64)
    private String pointId;

    /** 目标点位编码（MQTT 通道标识） */
    @Size(max = 64)
    @Column(name = "point_code", length = 64)
    private String pointCode;

    /** 写入值（字符串，触发时按点位类型转换） */
    @Size(max = 256)
    @Column(name = "value_text", length = 256)
    private String valueText;

    /** 排序（多条动作时按此顺序执行） */
    @Column(name = "sort_order")
    private Integer sortOrder;
}
