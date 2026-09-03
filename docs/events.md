# IoT 事件体系

## 类型 → 实现类

| 类型                              | 实现类                                                                    |
|-----------------------------------|---------------------------------------------------------------------------|
| `DataEvent<DataEntity>`           | `DataUpdateEvent`                                                         |
| `DeviceEvent<DeviceEntity>`       | `DeviceCreatedEvent` / `DeviceUpdatedEvent` / `DeviceEnabledChangedEvent` |
| `DeviceEvent<String>`             | `DeviceDeletedEvent` / `DeviceHeartbeatEvent` / `DeviceOfflineEvent`      |
| `DeviceEvent<PointEntity>`        | `PointCreatedEvent` / `PointUpdatedEvent`                                 |
| `DeviceEvent<List<String>>`       | `PointSortOrderChangedEvent`                                              |
| `DeviceEvent<Map<String,Object>>` | `PointDeletedEvent`                                                       |
| `IEvent<Map<String,Object>>`      | `AlarmTriggeredEvent`                                                     |

## 数据结构

### IEvent（所有事件统一信封）

```js
var json = {
  "eventId": "1820...",
  // 雪花 ID
  "tenantId": "0",
  // 租户；缺失时 SSE 兜底为 "0"
  "source": "device-service",
  // 事件来源（域接口或 alarm-engine）
  "occurredAt": "2026-09-02T...",
  // 发生时间
  "deviceId": "abc",
  // 关联设备，可空
  "pointCode": "p1",
  // 关联点位，可空
  "category": "device.created",
  // 事件分类，前端按 category 路由
  "payload": {
    ...
  }
  // 业务负载，结构见下表
}
```

| Category                  | Payload 结构                   |
|---------------------------|--------------------------------|
| `data.update`             | `{ ...DataEntity }`            |
| `device.created`          | `{ ...DeviceEntity }`          |
| `device.updated`          | `{ ...DeviceEntity }`          |
| `device.deleted`          | `{ ...DeviceEntity }`          |
| `device.enabled-changed`  | `{ ...DeviceEntity }`          |
| `device.online.heartbeat` | `{ ...DeviceEntity }`          |
| `device.online.offline`   | `{ ...DeviceEntity }`          |
| `point.created`           | `{ ...PointEntity }`           |
| `point.updated`           | `{ ...PointEntity }`           |
| `point.deleted`           | `{ ...PointEntity }`           |
| `alarm`                   | `{ ...AlarmMessage }`          |
