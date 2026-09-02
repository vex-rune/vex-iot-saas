package com.vex.iot.app.mqtt.usr;

import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.List;

public record DeviceUpReport(
        @JsonProperty("params") DeviceUpParams params
) {
    // params内部对象
    public record DeviceUpParams(
            @JsonProperty("dir") String dir,
            @JsonProperty("id") String id,
            @JsonProperty("sys_sn") String gatewayId,
            @JsonProperty("sys_imei") String sysImei,
            @JsonProperty("sys_local_time") String sysLocalTime,
            @JsonProperty("r_data") List<ReadDataItem> data
    ) {
    }

    public record ReadDataItem(
            @JsonProperty("name") String name,
            @JsonProperty("err") String err,
            @JsonProperty("value") String value  //上报有值的时候会携带value
    ) {
    }

    // 错误码 0 表示有效数据
    public static final String OK = "0";
    // 错误码 1 表示无效数据
    public static final String ERR_INVALID = "1";

}