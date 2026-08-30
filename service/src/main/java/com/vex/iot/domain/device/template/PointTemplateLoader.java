package com.vex.iot.domain.device.template;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.vex.iot.common.exception.BizException;
import com.vex.iot.common.exception.BusinessExceptions.InternalException;
import com.vex.iot.common.exception.BusinessExceptions.NotFoundException;
import com.vex.iot.domain.device.model.PointTemplate;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.io.Resource;
import org.springframework.core.io.support.PathMatchingResourcePatternResolver;
import org.springframework.stereotype.Component;

import java.util.*;

@Slf4j
@Component
@RequiredArgsConstructor
public class PointTemplateLoader {
    private static final String PATTERN = "classpath:templates/point-table/*.json";
    private final ObjectMapper objectMapper;
    private final Map<String, PointTemplate> cache = new LinkedHashMap<>();

    @PostConstruct
    public void load() {
        try {
            Resource[] resources = new PathMatchingResourcePatternResolver().getResources(PATTERN);
            for (Resource r : resources) {
                PointTemplate t = objectMapper.readValue(r.getInputStream(), PointTemplate.class);
                if (t.templateCode() == null || t.templateCode().isBlank())
                    throw new InternalException("模板缺少 templateCode: " + r.getFilename());
                cache.put(t.templateCode(), t);
                log.info("加载点表模板 code={} name={} points={}", t.templateCode(), t.templateName(),
                        t.points() == null ? 0 : t.points().size());
            }
        } catch (BizException ex) {
            //throw ex;
        } catch (Exception ex) {
            //throw new InternalException("加载点表模板失败: " + ex.getMessage(), ex);
        }
    }

    public List<PointTemplate> listAll() {
        return Collections.unmodifiableList(new ArrayList<>(cache.values()));
    }

    public PointTemplate get(String code) {
        PointTemplate t = cache.get(code);
        if (t == null) throw new NotFoundException("点表模板: " + code);
        return t;
    }
}
