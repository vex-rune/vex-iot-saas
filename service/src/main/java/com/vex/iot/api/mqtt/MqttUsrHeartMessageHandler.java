package com.vex.iot.api.mqtt;

import com.vex.iot.app.DeviceDataApp;
import com.vex.iot.app.mqtt.usr.MqttUsrHeartMessage;
import com.vex.iot.app.mqtt.usr.MqttUsrUpdateMessage;
import com.vex.iot.app.mqtt.usr.MqttUsrWillMessage;
import com.vex.iot.domain.device.DeviceService;
import org.springframework.context.event.EventListener;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;

@Component
public class MqttUsrHeartMessageHandler {


    private final DeviceDataApp dataApp;
    private final DeviceService deviceService;

    public MqttUsrHeartMessageHandler(DeviceDataApp dataApp, DeviceService deviceService) {
        this.dataApp = dataApp;
        this.deviceService = deviceService;
    }

    @Async
    @EventListener(MqttUsrHeartMessage.class)
    public void heart(MqttUsrHeartMessage event) {
        System.out.println("Received heart message: " + event);
        dataApp.heart(event);
    }
    @Async
    @EventListener(MqttUsrUpdateMessage.class)
    public void update(MqttUsrUpdateMessage event) {
        System.out.println("Received update message: " + event);
        dataApp.update(event);
    }
    @Async
    @EventListener(MqttUsrWillMessage.class)
    public void will(MqttUsrWillMessage event) {
        System.out.println("Received will message: " + event);
        dataApp.will(event);
    }
}
