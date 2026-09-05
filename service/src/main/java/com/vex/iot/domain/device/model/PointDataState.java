package com.vex.iot.domain.device.model;

import com.vex.iot.common.config.IEnum;
import lombok.AllArgsConstructor;
import lombok.Getter;

@AllArgsConstructor
public enum PointDataState implements IEnum {
    // 正常
    NORMAL("正常"),
    // 异常
    ERROR("异常");

    @Getter
    private final String description;

    


    
    @Override
    public String displayName() {
        return description;
    }
}
