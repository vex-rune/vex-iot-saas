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
@EnableMethodSecurity
@EnableConfigurationProperties({SecurityProperties.class, BootstrapProperties.class, TotpProperties.class})
public class SecurityConfig {

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
                                // 认证接口
                                "/api/auth/login",
                                // 验证码接口
                                "/api/auth/key-info",
                                // 健康监测
                                "/actuator/health"
                        )
                        .permitAll()
                        .anyRequest()
                        .authenticated())
                .addFilterBefore(jwtFilter, UsernamePasswordAuthenticationFilter.class);
        return http.build();
    }
}
