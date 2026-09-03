package com.vex.iot.domain.notify.channel;

import com.aliyun.dysmsapi20170525.Client;
import com.aliyun.dysmsapi20170525.models.SendSmsRequest;
import com.aliyun.dysmsapi20170525.models.SendSmsResponse;
import com.aliyun.teaopenapi.models.Config;
import com.vex.iot.domain.notify.config.AliyunSmsProperties;
import com.vex.iot.domain.notify.model.NotifyUserEntity;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

/**
 * 阿里云短信通道。依赖:
 * com.aliyun:dysmsapi20170525 + aliyun-java-sdk-core
 * (在 service/pom.xml 中引入,这里只引用类)
 * <p>
 * 启用条件:aliyun.sms.enabled=true 且 accessKeyId/secret 非空。
 * 未配置时由 Spring 跳过该 Bean,NotifyDispatchServer 自动降级为日志通道。
 */
@Slf4j
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(prefix = "aliyun.sms", name = "enabled", havingValue = "true")
public class SmsChannel implements NotifyChannel {

    private final AliyunSmsProperties props;
    private Client client;

    private static String escape(String s) {
        return s == null ? "" : s.replace("\\", "\\\\").replace("\"", "\\\"");
    }

    @PostConstruct
    public void init() {
        try {
            Config cfg = new Config()
                    .setAccessKeyId(props.getAccessKeyId())
                    .setAccessKeySecret(props.getAccessKeySecret())
                    .setEndpoint(props.getEndpoint() == null ? "dysmsapi.aliyuncs.com" : props.getEndpoint());
            this.client = new Client(cfg);
            log.info("阿里云短信通道已初始化 endpoint={} sign={}", cfg.getEndpoint(), props.getSignName());
        } catch (Exception ex) {
            log.error("阿里云短信通道初始化失败", ex);
            this.client = null;
        }
    }

    @Override
    public String name() {
        return "SMS";
    }

    @Override
    public boolean isEnabled(NotifyUserEntity user) {
        return user != null && user.isSmsEnabled() && user.getPhone() != null && !user.getPhone().isBlank();
    }

    @Override
    public boolean send(NotifyUserEntity user, String message) {
        if (client == null) {
            log.warn("[SMS-DISABLED] user={} msg={}", user.getId(), message);
            return false;
        }
        try {
            SendSmsRequest req = new SendSmsRequest()
                    .setPhoneNumbers(user.getPhone())
                    .setSignName(props.getSignName())
                    .setTemplateCode(props.getTemplateCode())
                    .setTemplateParam("{\"content\":\"" + escape(message) + "\"}");
            SendSmsResponse resp = client.sendSms(req);
            if (resp == null || resp.getBody() == null) {
                log.warn("[SMS-EMPTY] user={} phone={}", user.getId(), user.getPhone());
                return false;
            }
            String code = resp.getBody().getCode();
            if (!"OK".equalsIgnoreCase(code)) {
                log.warn("[SMS-FAIL] user={} phone={} code={} msg={}",
                        user.getId(), user.getPhone(), code, resp.getBody().getMessage());
                return false;
            }
            log.info("[SMS-OK] user={} phone={}", user.getId(), user.getPhone());
            return true;
        } catch (Exception ex) {
            log.error("[SMS-ERROR] user={} phone={}", user.getId(), user.getPhone(), ex);
            return false;
        }
    }
}
