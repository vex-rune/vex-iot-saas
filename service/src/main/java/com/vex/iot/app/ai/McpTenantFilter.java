package com.vex.iot.app.ai;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.nio.charset.StandardCharsets;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.ReadListener;
import jakarta.servlet.ServletInputStream;
import jakarta.servlet.http.HttpServletRequestWrapper;

/**
 * MCP 请求过滤器 — 同时承担两件事:
 * <ol>
 *   <li><b>API Key 鉴权</b>:当 {@code vex.mcp.enabled=true} 时校验
 *       {@code X-MCP-Key} (可配置) header 是否在白名单中,失败直接 401。</li>
 *   <li><b>租户上下文绑定</b>:从 header / JSON-RPC body 中提取 tenantId
 *       并写入 {@link McpTenantContext},请求结束 finally 清空 ThreadLocal。</li>
 * </ol>
 *
 * <p>生效路径:/mcp/** (Spring AI MCP Server WebMVC 启动器注册的 endpoint)。</p>
 *
 * <p>注意:鉴权放在 Filter 中是为了避免暴露 /mcp endpoint 给未授权客户端,
 * 真正的 tenantId → 资源访问权限校验仍然在 Tool 方法内部完成(通过
 * {@code req.withTenantFilter(tenantId)})。</p>
 */
@Slf4j
@Component
@Order(Ordered.HIGHEST_PRECEDENCE + 100)
@RequiredArgsConstructor
public class McpTenantFilter extends OncePerRequestFilter {

    private static final String MCP_PATH_PREFIX = "/mcp";
    private static final String TENANT_HEADER = "X-Tenant-Id";
    private static final ObjectMapper MAPPER = new ObjectMapper();

    private final McpProperties properties;

    private static boolean constantTimeEquals(String a, String b) {
        if (a == null || b == null) return false;
        byte[] aa = a.getBytes(StandardCharsets.UTF_8);
        byte[] bb = b.getBytes(StandardCharsets.UTF_8);
        if (aa.length != bb.length) return false;
        int diff = 0;
        for (int i = 0; i < aa.length; i++) {
            diff |= aa[i] ^ bb[i];
        }
        return diff == 0;
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        String uri = request.getRequestURI();
        // 仅拦截 MCP endpoint
        return uri == null || !uri.startsWith(MCP_PATH_PREFIX);
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {
        // 1) API Key 鉴权
        if (properties.isEnabled() && !isValidApiKey(request)) {
            log.warn("[MCP] unauthorized request: uri={}, remoteAddr={}",
                    request.getRequestURI(), request.getRemoteAddr());
            writeUnauthorized(response);
            return;
        }

        // 2) 租户上下文绑定
        CachedBodyRequestWrapper wrapped = new CachedBodyRequestWrapper(request);
        String tenantId = resolveTenantId(wrapped);
        if (tenantId != null && !tenantId.isBlank()) {
            McpTenantContext.setTenantId(tenantId);
            log.debug("[MCP] tenantId={} bound to context for {}", tenantId, request.getRequestURI());
        }
        try {
            filterChain.doFilter(wrapped, response);
        } finally {
            McpTenantContext.clear();
        }
    }

    /**
     * 校验 API Key:常量时间比对,防止时序攻击。
     */
    private boolean isValidApiKey(HttpServletRequest request) {
        String supplied = request.getHeader(properties.getKeyHeader());
        if (supplied == null || supplied.isBlank()) {
            return false;
        }
        for (String valid : properties.getApiKeys()) {
            if (constantTimeEquals(valid, supplied)) {
                return true;
            }
        }
        return false;
    }

    private void writeUnauthorized(HttpServletResponse response) throws IOException {
        response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        response.setCharacterEncoding(StandardCharsets.UTF_8.name());
        // JSON-RPC 风格错误,让 MCP 客户端能识别
        response.getWriter().write(
                "{\"jsonrpc\":\"2.0\",\"error\":{\"code\":-32001,\"message\":\"Unauthorized: invalid or missing MCP API Key\"},\"id\":null}");
    }

    private String resolveTenantId(HttpServletRequest request) throws IOException {
        // 1) HTTP header (推荐)
        String header = request.getHeader(TENANT_HEADER);
        if (header != null && !header.isBlank()) {
            return header.trim();
        }

        // 2) JSON-RPC body 解析 (仅在 POST 时尝试)
        if (!"POST".equalsIgnoreCase(request.getMethod())) {
            return null;
        }
        try {
            byte[] body = request.getInputStream().readAllBytes();
            if (body == null || body.length == 0) {
                return null;
            }
            JsonNode root = MAPPER.readTree(body);
            JsonNode meta = root.path("params").path("_meta");
            if (meta.has("tenantId")) {
                return meta.get("tenantId").asText(null);
            }
            JsonNode tenantNode = root.path("params").path("tenantId");
            if (!tenantNode.isMissingNode()) {
                return tenantNode.asText(null);
            }
            return null;
        } catch (Exception e) {
            log.debug("[MCP] parse body for tenantId failed: {}", e.getMessage());
            return null;
        }
    }

    /**
     * 缓存请求体,使得 Filter 之后下游(InputStream)仍可继续读取。
     * 仅服务于本 Filter 解析元数据用途,不会对请求体做任何修改。
     */
    static class CachedBodyRequestWrapper extends HttpServletRequestWrapper {
        private final byte[] cachedBody;

        CachedBodyRequestWrapper(HttpServletRequest request) throws IOException {
            super(request);
            this.cachedBody = request.getInputStream().readAllBytes();
        }

        byte[] getCachedBody() {
            return cachedBody;
        }

        @Override
        public ServletInputStream getInputStream() {
            return new CachedServletInputStream(cachedBody);
        }

        @Override
        public java.io.BufferedReader getReader() {
            return new java.io.BufferedReader(new java.io.InputStreamReader(
                    new java.io.ByteArrayInputStream(cachedBody), StandardCharsets.UTF_8));
        }
    }

    static class CachedServletInputStream extends ServletInputStream {
        private final java.io.ByteArrayInputStream buffer;

        CachedServletInputStream(byte[] body) {
            this.buffer = new java.io.ByteArrayInputStream(body);
        }

        @Override
        public int read() {
            return buffer.read();
        }

        @Override
        public boolean isFinished() {
            return buffer.available() == 0;
        }

        @Override
        public boolean isReady() {
            return true;
        }

        @Override
        public void setReadListener(ReadListener listener) {
            // no-op (同步 filter 不需要异步监听)
        }
    }
}
