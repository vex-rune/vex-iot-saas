package com.vex.iot.domain.data.event;

import com.vex.iot.domain.data.model.DataEntity;
import org.springframework.context.ApplicationEvent;

public record DataUpdateEvent(
        DataEntity data
) {
}
