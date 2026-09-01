package com.vex.iot.api.http.model;

import jakarta.validation.constraints.NotEmpty;

import java.util.List;

/**
 * 点位排序请求体: 按新顺序排列的点位ID列表
 */
public record PointSortOrderRequest(
        @NotEmpty(message = "点位ID列表不能为空") List<String> pointIds
) {
}
