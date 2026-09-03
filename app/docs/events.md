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
{
  "metadata": {
    "eventId": "eventId_b6156ef2b846",
    "tenantId": "tenantId_b3f176bdf933",
    "source": "source_fc722b452523",
    "occurredAt": "2026-09-02 14:37:37",
    "deviceId": "deviceId_136e95691da6",
    "category": "category_53bc588233ef"
  },
  "payload": {
    // 请看对照 Payload 结构
  }
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
