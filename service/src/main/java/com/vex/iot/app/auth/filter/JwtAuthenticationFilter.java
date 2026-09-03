package com.vex.iot.app.auth.filter;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.vex.iot.app.auth.config.SecurityProperties;
import com.vex.iot.app.auth.model.LoginUser;
import com.vex.iot.app.auth.util.JwtHandler;
import com.vex.iot.common.constants.RoleConstants;
import com.vex.iot.common.exception.BizException;
import com.vex.iot.common.model.CurrentUser;
import com.vex.iot.common.response.Response;
import com.vex.iot.common.util.UserContext;
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
        // 只跳过"完全不需要 JWT"的端点:
        //   - POST /api/auth/login   登录入口(还没 token)
        //   - GET  /api/auth/key-info 登录前的握手(还没 token)
        // 其他 /api/auth/** 端点(GET /me、GET /tenants 等)需要 JWT 过滤器正常工作,
        // 否则 SecurityContext / UserContext 都为空,controller 拿不到当前用户。
        if ("POST".equalsIgnoreCase(req.getMethod()) && "/api/auth/login".equals(path)) {
            return true;
        }
        if ("GET".equalsIgnoreCase(req.getMethod()) && "/api/auth/key-info".equals(path)) {
            return true;
        }
        return false;
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
