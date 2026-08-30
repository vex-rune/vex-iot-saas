package com.vex.iot.domain.pdata.parser;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.vex.iot.common.exception.BizException;
import com.vex.iot.common.exception.BusinessExceptions.BadRequestException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * USR-G771 边缘网关 JSON 上报报文解析器。
 * 仅识别 docs/有人/边缘网关_USR-G771_MQTT_上报与写数据.md §3 描述的标准格式。
 * 解析失败抛 BadRequestException,由调用方记录日志后丢弃。
 */
@Component
@RequiredArgsConstructor
public class UsrG771Parser {

    /**
     * 上行报文根节点固定为 "params",下行根节点固定为 "rw_prot",用于快速分流。
     */
    private static final String PARAMS = "params";
    private static final String DIR_UP = "up";
    private final ObjectMapper objectMapper;

    private static String textOrNull(JsonNode node, String field) {
        if (node == null) return null;
        JsonNode v = node.get(field);
        if (v == null || v.isNull()) return null;
        return v.isValueNode() ? v.asText() : v.toString();
    }

    private static Instant parseTs(JsonNode tsNode) {
        if (tsNode == null || tsNode.isNull()) return null;
        if (tsNode.isNumber()) {
            long n = tsNode.asLong();
            return n > 0 ? Instant.ofEpochMilli(n) : null;
        }
        try {
            return Instant.parse(tsNode.asText());
        } catch (Exception ex) {
            return null;
        }
    }

    public UsrG771Payload parse(byte[] payload) {
        if (payload == null || payload.length == 0) {
            throw new BadRequestException("上报报文为空");
        }
        try {
            JsonNode root = objectMapper.readTree(payload);
            JsonNode params = root.get(PARAMS);
            if (params == null) {
                throw new BadRequestException("上报报文缺少 params 节点");
            }
            String dir = textOrNull(params, "dir");
            if (!DIR_UP.equals(dir)) {
                throw new BadRequestException("上行报文 dir 必须为 up,实际=" + dir);
            }
            String deviceCode = textOrNull(params, "id");
            if (deviceCode == null || deviceCode.isBlank()) {
                throw new BadRequestException("上行报文缺少设备 id");
            }
            JsonNode rData = params.get("r_data");
            if (rData == null || !rData.isArray()) {
                throw new BadRequestException("上行报文缺少 r_data 数组");
            }
            Map<String, String> values = new LinkedHashMap<>();
            Map<String, String> errors = new LinkedHashMap<>();
            List<String> names = new ArrayList<>(rData.size());
            for (JsonNode item : rData) {
                String name = textOrNull(item, "name");
                if (name == null || name.isBlank()) continue;
                names.add(name);
                values.put(name, textOrNull(item, "value"));
                errors.put(name, textOrNull(item, "err"));
            }
            Instant ts = parseTs(params.get("ts"));
            return UsrG771Payload.builder()
                    .deviceCode(deviceCode)
                    .deviceTimestamp(ts)
                    .values(values)
                    .errors(errors)
                    .pointNames(names)
                    .build();
        } catch (BizException ex) {
            throw ex;
        } catch (Exception ex) {
            throw new BadRequestException("上报报文解析失败: " + ex.getMessage());
        }
    }
}
