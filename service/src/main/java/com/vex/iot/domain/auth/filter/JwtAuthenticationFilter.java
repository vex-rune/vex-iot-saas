package com.vex.iot.domain.auth.filter;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.vex.iot.common.constants.RoleConstants;
import com.vex.iot.common.exception.BizException;
import com.vex.iot.common.model.CurrentUser;
import com.vex.iot.common.response.Response;
import com.vex.iot.common.util.UserContext;
import com.vex.iot.domain.auth.config.SecurityProperties;
import com.vex.iot.domain.auth.model.LoginUser;
import com.vex.iot.domain.auth.util.JwtHandler;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.List;

@Component
public class JwtAuthenticationFilter extends OncePerRequestFilter {
    private final JwtHandler jwtHandler;
    private final SecurityProperties props;
    private final ObjectMapper objectMapper;

    public JwtAuthenticationFilter(JwtHandler jwtHandler, SecurityProperties props, ObjectMapper objectMapper) {
        this.jwtHandler = jwtHandler;
        this.props = props;
        this.objectMapper = objectMapper;
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest req) {
        String path = req.getRequestURI();
        return path.startsWith("/api/auth/login");
    }

    @Override
    protected void doFilterInternal(HttpServletRequest req, HttpServletResponse res, FilterChain chain)
            throws ServletException, IOException {
        try {
            String auth = req.getHeader(props.header());
            String token = jwtHandler.resolveToken(auth);
            if (token != null && !token.isBlank()) {
                LoginUser lu = jwtHandler.parse(token);
                CurrentUser cu = new CurrentUser(lu.userId(), lu.username(), null,
                        lu.tenantId(), lu.roles());
                UserContext.set(cu);
                List<SimpleGrantedAuthority> authorities = resolveAuthorities(lu.roles());
                SecurityContextHolder.getContext().setAuthentication(
                        new UsernamePasswordAuthenticationToken(lu, token, authorities));
            }
            chain.doFilter(req, res);
        } catch (BizException ex) {
            int httpStatus = ("forbidden".equals(ex.getCode()))
                    ? HttpServletResponse.SC_FORBIDDEN
                    : HttpServletResponse.SC_UNAUTHORIZED;
            writeError(res, httpStatus, ex.getCode(), ex.getMessage());
        } finally {
            UserContext.clear();
        }
    }

    private void writeError(HttpServletResponse res, int httpStatus, String code, String msg) throws IOException {
        res.setStatus(httpStatus);
        res.setContentType(MediaType.APPLICATION_JSON_VALUE);
        res.setCharacterEncoding("UTF-8");
        res.getWriter().write(objectMapper.writeValueAsString(Response.fail(code, msg)));
    }

    /**
     * 超级管理员隐含全部业务角色,避免超管因缺少具体角色被拦。
     */
    private List<SimpleGrantedAuthority> resolveAuthorities(java.util.Set<String> roles) {
        java.util.Set<String> effective = (roles != null && roles.contains(RoleConstants.SUPER_ADMIN))
                ? java.util.Set.of(RoleConstants.SUPER_ADMIN, RoleConstants.ADMIN,
                        RoleConstants.OPERATOR, RoleConstants.GUEST)
                : (roles == null ? java.util.Set.of() : roles);
        return effective.stream()
                .map(r -> new SimpleGrantedAuthority(RoleConstants.ROLE_PREFIX + r))
                .toList();
    }
}
