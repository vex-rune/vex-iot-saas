package com.vex.iot.domain.device.model;

import com.vex.iot.common.enums.AccessType;
import com.vex.iot.common.enums.DataType;
import com.vex.iot.common.enums.RegisterType;

import java.util.List;

public record PointTemplate(
        String templateCode,
        String templateName,
        String deviceType,
        String version,
        String description,
        List<PointTemplateItem> points
) {
    public record PointTemplateItem(
            String pointCode,
            String pointName,
            RegisterType registerType,
            Integer addressOffset,
            Integer bitOffset,
            DataType dataType,
            AccessType access,
            Boolean analogConvert,
            String forwardFormula,
            String reverseFormula,
            String defaultValue,
            String unit,
            String description
    ) {
    }
}
