package com.vex.iot.domain.data.model;

import lombok.AllArgsConstructor;
import lombok.Getter;

@AllArgsConstructor
public enum PointDataState {
    // 正常
    NORMAL("正常"),
    // 异常
    ERROR("异常");

    @Getter
    private final String description;

}
