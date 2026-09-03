package com.vex.iot.domain.schedule.model;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;

import java.util.ArrayList;
import java.util.List;

/**
 * ScheduleAction JSON 转换器。
 * <p>将 List&lt;ScheduleAction&gt; 与 JSON 字符串互转。
 */
@Converter(autoApply = true)
public class ScheduleActionConverter implements AttributeConverter<List<ScheduleAction>, String> {

    private static final ObjectMapper MAPPER = new ObjectMapper();
    private static final TypeReference<List<ScheduleAction>> TYPE = new TypeReference<>() {
    };

    @Override
    public String convertToDatabaseColumn(List<ScheduleAction> attribute) {
        if (attribute == null || attribute.isEmpty()) {
            return "[]";
        }
        try {
            return MAPPER.writeValueAsString(attribute);
        } catch (JsonProcessingException e) {
            throw new RuntimeException("序列化 ScheduleAction 失败", e);
        }
    }

    @Override
    public List<ScheduleAction> convertToEntityAttribute(String dbData) {
        if (dbData == null || dbData.isBlank()) {
            return new ArrayList<>();
        }
        try {
            return MAPPER.readValue(dbData, TYPE);
        } catch (JsonProcessingException e) {
            throw new RuntimeException("反序列化 ScheduleAction 失败", e);
        }
    }
}
