package com.vex.iot.app.mqtt.usr;

import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.List;

/**
 * G770 DTU 应答报文 rw_prot (dir=rsp)
 */
public record DeviceRspReport(
        @JsonProperty("rw_prot")
        RwProt rwProt
) {

    public record RwProt(
            @JsonProperty("Ver")
            String ver,
            @JsonProperty("dir")
            String dir,
            @JsonProperty("id")
            String id,
            @JsonProperty("r_data")
            List<RwData> rData
    ) {
    }

    public record RwData(
            @JsonProperty("name")
            String name,
            @JsonProperty("value")
            String value,
            @JsonProperty("err")
            String err
    ) {
    }
}
