package com.vex.iot.app.auth.config;

import com.vex.iot.app.auth.filter.JwtAuthenticationFilter;
import com.vex.iot.app.auth.handler.RestAuthHandlers;
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

import java.util.List;

/**
 * Spring Security 配置
 */
@Configuration
@EnableMethodSecurity(prePostEnabled = true)
@EnableConfigurationProperties({SecurityProperties.class, BootstrapProperties.class})
public class SecurityConfig {

    /**
     * 认证管理器
     *
     * @param adminAuthenticationProvider 管理员认证提供者
     * @param userAuthenticationProvider  普通用户认证提供者
     * @return 认证管理器
     */
    @Bean
    public AuthenticationManager authenticationManager(
            AdminAuthenticationProvider adminAuthenticationProvider,
            UserAuthenticationProvider userAuthenticationProvider) {
        return new ProviderManager(List.of(adminAuthenticationProvider, userAuthenticationProvider));
    }

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http, JwtAuthenticationFilter jwtFilter, RestAuthHandlers handlers) throws Exception {
        http
                .csrf(AbstractHttpConfigurer::disable)
                .cors(AbstractHttpConfigurer::disable)
                .formLogin(AbstractHttpConfigurer::disable)
                .httpBasic(AbstractHttpConfigurer::disable)
                .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .exceptionHandling(e -> e.authenticationEntryPoint(handlers).accessDeniedHandler(handlers))
                .authorizeHttpRequests(reg -> reg
                        .requestMatchers(
                                "/api/auth/login"
                        ).permitAll()
                        .anyRequest()
                        .authenticated())
                .addFilterBefore(jwtFilter, UsernamePasswordAuthenticationFilter.class);
        return http.build();
    }
}
