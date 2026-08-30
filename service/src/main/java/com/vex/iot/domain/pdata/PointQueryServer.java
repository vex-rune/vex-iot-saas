package com.vex.iot.domain.pdata;

import com.vex.iot.domain.device.exception.DeviceNotFoundException;
import com.vex.iot.domain.device.model.DeviceEntity;
import com.vex.iot.domain.device.repository.DeviceRepository;
import com.vex.iot.domain.pdata.model.PointHistoryEntity;
import com.vex.iot.domain.pdata.model.PointRealtimeEntity;
import com.vex.iot.domain.pdata.repository.PointHistoryRepository;
import com.vex.iot.domain.pdata.repository.PointRealtimeRepository;
import com.vex.iot.domain.device.model.PointDefinitionEntity;
import com.vex.iot.domain.device.repository.PointDefinitionRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.*;

@Slf4j
@Service
@RequiredArgsConstructor
public class PointQueryServer {
    private static final int MAX_HISTORY_POINTS = 5000;
    private final DeviceRepository deviceRepository;
    private final PointDefinitionRepository pointRepository;
    private final PointRealtimeRepository realtimeRepository;
    private final PointHistoryRepository historyRepository;

    public Map<String, Object> realtime(String deviceId) {
        DeviceEntity d = deviceRepository.findById(deviceId).orElseThrow(DeviceNotFoundException::new);
        List<PointRealtimeEntity> realtimes = realtimeRepository.findByDeviceId(deviceId);
        List<PointDefinitionEntity> defs = pointRepository.findByDeviceId(deviceId);
        Map<String, PointDefinitionEntity> defMap = indexByCode(defs);

        List<Map<String, Object>> rows = new ArrayList<>();
        for (PointRealtimeEntity rt : realtimes) {
            rows.add(toRow(defMap.get(rt.getPointCode()), rt));
        }

        Map<String, Object> resp = new LinkedHashMap<>();
        resp.put("deviceId", d.getId());
        resp.put("deviceCode", d.getDeviceCode());
        resp.put("timestamp", realtimes.isEmpty() ? null : realtimes.get(0).getTimestamp());
        resp.put("points", rows);
        return resp;
    }

    public List<Map<String, Object>> history(String deviceId, String pointCode, Instant from, Instant to, int limit) {
        DeviceEntity d = deviceRepository.findById(deviceId).orElseThrow(DeviceNotFoundException::new);
        int safeLimit = Math.min(Math.max(limit, 1), MAX_HISTORY_POINTS);

        List<PointHistoryEntity> readings = historyRepository.findByDeviceIdAndPointCodeAndTimestampBetween(
                d.getId(), pointCode, from, to,
                PageRequest.of(0, safeLimit + 1, Sort.by(Sort.Direction.ASC, "timestamp")));
        boolean truncated = readings.size() > safeLimit;
        if (truncated) readings = readings.subList(0, safeLimit);

        PointHistoryEntity firstReading = readings.isEmpty() ? null : readings.get(0);
        PointHistoryEntity before = firstReading != null && firstReading.getTimestamp().equals(from) ? null
                : historyRepository.findFirstByDeviceIdAndPointCodeAndTimestampLessThanEqualOrderByTimestampDesc(
                        d.getId(), pointCode, from).orElse(null);

        PointDefinitionEntity def = indexByCode(pointRepository.findByDeviceId(deviceId)).get(pointCode);

        List<Map<String, Object>> result = new ArrayList<>();
        if (before != null) result.add(historyRow(def, pointCode, from, before.getValue()));
        for (PointHistoryEntity r : readings) result.add(historyRow(def, pointCode, r.getTimestamp(), r.getValue()));
        if (!truncated) {
            Instant lastTs = readings.isEmpty() ? (before != null ? from : null) : readings.get(readings.size() - 1).getTimestamp();
            if (lastTs != null && !lastTs.equals(to)) {
                String lastValue = readings.isEmpty() ? before.getValue() : readings.get(readings.size() - 1).getValue();
                result.add(historyRow(def, pointCode, to, lastValue));
            }
        }
        return result;
    }

    private Map<String, PointDefinitionEntity> indexByCode(List<PointDefinitionEntity> defs) {
        Map<String, PointDefinitionEntity> m = new HashMap<>(defs.size());
        for (PointDefinitionEntity d : defs) m.put(d.getPointCode(), d);
        return m;
    }

    private Map<String, Object> toRow(PointDefinitionEntity def, PointRealtimeEntity rt) {
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("pointCode", rt.getPointCode());
        row.put("pointName", def == null ? rt.getPointCode() : def.getPointName());
        row.put("rawValue", rt.getRawValue());
        row.put("displayValue", rt.getValue());
        row.put("unit", def == null ? null : def.getUnit());
        row.put("pointStatus", rt.getPointStatus() != null ? rt.getPointStatus().name() : null);
        row.put("alarmLevel", rt.getAlarmLevel());
        return row;
    }

    private Map<String, Object> historyRow(PointDefinitionEntity def, String code, Instant ts, String raw) {
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("timestamp", ts);
        row.put("pointCode", code);
        row.put("pointName", def == null ? code : def.getPointName());
        row.put("rawValue", raw);
        row.put("displayValue", raw);
        row.put("unit", def == null ? null : def.getUnit());
        return row;
    }
}
