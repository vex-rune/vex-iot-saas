package com.vex.iot.app.auth.config;

import com.vex.iot.app.auth.filter.JwtAuthenticationFilter;
import com.vex.iot.app.auth.handler.RestAuthHandlers;
import com.vex.iot.app.auth.util.TotpProperties;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.ProviderManager;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.List;

/**
 * Spring Security 配置
 *
 * <p>
 * CORS：默认全部放开（{@code allowedOriginPatterns="*"}），开发期方便联调；
 * 生产可由 {@code application.yml} 维护具体 origin 列表进行收口。
 */
@Configuration
@EnableMethodSecurity(prePostEnabled = true)
@EnableConfigurationProperties({SecurityProperties.class, BootstrapProperties.class, TotpProperties.class})
public class SecurityConfig {

    /**
     * CORS 配置 — {@code allowAll()} 形态：任意来源、常用方法、所有请求头、跨域凭据关闭。
     *
     * <p>
     * 与
     * 中的 {@code http.cors(c -> {})} 配合启用 Spring Security 的 CORS 过滤器。
     */
    @Bean
    public UrlBasedCorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration cfg = new CorsConfiguration();
        // allowedOriginPatterns 支持通配符；allowedOrigins 不允许 "*" 与 allowCredentials=true 同时
        cfg.setAllowedOriginPatterns(List.of("*"));
        cfg.setAllowedMethods(List.of("GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"));
        cfg.setAllowedHeaders(List.of("*"));
        cfg.setExposedHeaders(List.of("Authorization", "Content-Disposition"));
        cfg.setAllowCredentials(false);
        cfg.setMaxAge(3600L);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", cfg);
        return source;
    }

    /**
     * 认证管理器
     */
    @Bean
    public AuthenticationManager authenticationManager(
            AdminAuthenticationProvider adminAuthenticationProvider,
            UserAuthenticationProvider userAuthenticationProvider,
            UserRefreshTokenAuthenticationProvider userRefreshTokenAuthenticationProvider) {
        return new ProviderManager(List.of(
                adminAuthenticationProvider,
                userAuthenticationProvider,
                userRefreshTokenAuthenticationProvider));
    }

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http,
                                           JwtAuthenticationFilter jwtFilter,
                                           RestAuthHandlers handlers,
                                           UrlBasedCorsConfigurationSource corsSource) throws Exception {
        http
                .csrf(AbstractHttpConfigurer::disable)
                .cors(c -> c.configurationSource(corsSource))
                .formLogin(AbstractHttpConfigurer::disable)
                .httpBasic(AbstractHttpConfigurer::disable)
                .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .exceptionHandling(e -> e.authenticationEntryPoint(handlers).accessDeniedHandler(handlers))
                .authorizeHttpRequests(reg -> reg
                        .requestMatchers(
                                "/api/auth/login",
                                "/api/auth/key-info")
                        .permitAll()
                        .anyRequest()
                        .authenticated())
                .addFilterBefore(jwtFilter, UsernamePasswordAuthenticationFilter.class);
        return http.build();
    }
}
