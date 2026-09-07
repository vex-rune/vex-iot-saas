package com.vex.iot.app.web;

import jakarta.servlet.*;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

import java.io.IOException;

/**
 * 跨域处理
 */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
public class CORSFilter implements Filter {

//
//    /**
//     * CORS 配置 — {@code allowAll()} 形态：任意来源、常用方法、所有请求头、跨域凭据关闭。
//     *
//     * <p>
//     * 与
//     * 中的 {@code http.cors(c -> {})} 配合启用 Spring Security 的 CORS 过滤器。
//     */
//    @Bean
//    public UrlBasedCorsConfigurationSource corsConfigurationSource() {
//        CorsConfiguration cfg = new CorsConfiguration();
//        // allowedOriginPatterns 支持通配符；allowedOrigins 不允许 "*" 与 allowCredentials=true 同时
//        cfg.setAllowedOriginPatterns(List.of("*"));
//        cfg.setAllowedMethods(List.of("GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"));
//        cfg.setAllowedHeaders(List.of("*"));
//        cfg.setExposedHeaders(List.of("Authorization", "Content-Disposition"));
//        cfg.setAllowCredentials(false);
//        cfg.setMaxAge(3600L);
//
//        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
//        source.registerCorsConfiguration("/**", cfg);
//        return source;
//    }


    @Override
    public void doFilter(ServletRequest req, ServletResponse res, FilterChain chain) throws IOException, ServletException {
        HttpServletResponse response = (HttpServletResponse) res;
        HttpServletRequest request = (HttpServletRequest) req;
        response.setHeader("Access-Control-Allow-Origin", "*");
        response.setHeader("Access-Control-Allow-Methods", "*");
        response.setHeader("Access-Control-Allow-Headers", "*");
        response.setHeader("Access-Control-Max-Age", "3600");
        //response.setHeader("Access-Control-Expose-Headers","yourCustomHeaderIfExist");

        if ("OPTIONS".equalsIgnoreCase(request.getMethod())) {
            response.setStatus(HttpServletResponse.SC_OK);
        } else {
            chain.doFilter(req, res);
        }
    }

    @Override
    public void init(FilterConfig filterConfig) {
        // 初始化代码（如果有需要）
    }

    @Override
    public void destroy() {
        // 销毁代码（如果有需要）
    }

}