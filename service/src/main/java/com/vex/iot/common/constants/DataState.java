package com.vex.iot.common.constants;

/**
 * 数据状态常量:用于 BaseEntity.state 字段。
 * - NORMAL  = 0  正常数据
 * - DELETED = -1 软删除标记
 */
public final class DataState {
    public static final int NORMAL = 0;
    public static final int DELETED = -1;

    private DataState() {
    }
}
