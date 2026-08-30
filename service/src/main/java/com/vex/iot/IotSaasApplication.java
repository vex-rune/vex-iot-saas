package com.vex.iot;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.autoconfigure.domain.EntityScan;
import org.springframework.data.jpa.repository.config.EnableJpaRepositories;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.scheduling.annotation.EnableScheduling;

/**
 * Vex云物联应用启动类
 */
@EnableAsync
@EnableScheduling
@EntityScan(basePackages = "com.vex.iot.domain")
@EnableJpaRepositories(basePackages = {
        "com.vex.iot.domain.**"
})
@SpringBootApplication(scanBasePackages = "com.vex.iot")
public class IotSaasApplication {

    public static void main(String[] args) {
        SpringApplication.run(IotSaasApplication.class, args);
    }
}