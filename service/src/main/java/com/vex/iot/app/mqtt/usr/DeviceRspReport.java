package com.vex.iot.app.mqtt.usr;

import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.List;

/**
 * G770 DTU 应答报文 rw_prot (dir=rsp)
 *
 * {
 *   "rw_prot": {
 *     "Ver": "1.0.1",
 *     "dir": "down",
 *     "id": "00601924061200038538",
 *     "r_data": [
 *       { "name": "data1" },
 *       { "name": "data2" },
 *       { "name": "data3" }
 *     ],
 *     "w_data": [
 *       { "name": "data1", "value": "100" },
 *       { "name": "data2", "value": "200" },
 *       { "name": "data3", "value": "300" }
 *     ]
 *   }
 * }
 *
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
            List<RData> rData,
            @JsonProperty("w_data")
            List<WData> wData
    ) {
    }

    public record RData(
            @JsonProperty("name")
            String name
    ) {
    }
    public record WData(
            @JsonProperty("name")
            String name,
            @JsonProperty("value")
            String value
    ) {
    }
}
