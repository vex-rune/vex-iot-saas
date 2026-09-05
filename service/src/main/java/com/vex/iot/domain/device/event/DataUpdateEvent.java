package com.vex.iot.domain.device.event;

import com.vex.iot.common.util.IdGenerator;
import com.vex.iot.domain.device.model.DataEntity;
import com.vex.iot.common.event.IEvent;
import lombok.Data;

import java.time.Instant;

/// 点位实时数据更新事件 — Data 域唯一事件。
@Data
public final class DataUpdateEvent implements DataEvent<DataEntity> {

    public static final String CATEGORY = "data.update";

    /// 元数据（category 固定为 {@link #CATEGORY}）
    private final IEvent.Metadata metadata;

    /// 业务负载
    private final DataEntity payload;

    public DataUpdateEvent(DataEntity data) {
        this.metadata = new IEvent.Metadata(
                IdGenerator.snowId(),
                data == null ? null : data.getTenantId(),
                DOMAIN_SOURCE,
                data == null || data.getTimestamp() == null ? Instant.now() : data.getTimestamp(),
                data == null ? null : data.getDeviceId(),
                data == null ? null : data.getPointId(),
                CATEGORY
        );
        this.payload = data;
    }

    /// 旧 record 形态访问器 — 兼容 AlarmApp.onAlarm(snap.data())
    public DataEntity data() {
        return payload;
    }
}