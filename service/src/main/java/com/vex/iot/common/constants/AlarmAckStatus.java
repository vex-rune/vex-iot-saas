package com.vex.iot.common.constants;

/**
 * 告警确认状态常量
 *
 * <p>用于告警事件的确认状态字段。
 */
public final class AlarmAckStatus {

    /**
     * 未确认
     */
    public static final int UNACK = 0;

    /**
     * 已确认
     */
    public static final int ACK = 1;

    private AlarmAckStatus() {
    }
}
