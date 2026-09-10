package com.vex.iot.app.ai;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockFilterChain;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

import java.io.IOException;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

/**
 * McpTenantFilter 单元测试 — 用 Spring MockServlet API 验证鉴权 + 租户上下文。
 */
@DisplayName("McpTenantFilter 单元测试")
class McpTenantFilterTest {

    private McpTenantFilter filter;
    private McpProperties properties;

    @BeforeEach
    void setup() {
        properties = new McpProperties();
        filter = new McpTenantFilter(properties);
        McpTenantContext.clear();
    }

    @AfterEach
    void tearDown() {
        McpTenantContext.clear();
    }

    @Test
    @DisplayName("非 /mcp 路径直接放行,不校验 API Key,不绑定 tenant")
    void nonMcpPath_skipped() throws ServletException, IOException {
        properties.setEnabled(true);
        properties.setApiKeys(List.of("valid-key"));

        MockHttpServletRequest req = new MockHttpServletRequest("GET", "/api/devices/query");
        MockHttpServletResponse resp = new MockHttpServletResponse();
        MockFilterChain chain = new MockFilterChain();

        filter.doFilter(req, resp, chain);

        assertThat(resp.getStatus()).isEqualTo(200);
        assertThat(McpTenantContext.getTenantId()).isNull();
    }

    @Test
    @DisplayName("鉴权关闭时,任意 Key 都能通过")
    void authDisabled_passesThrough() throws ServletException, IOException {
        properties.setEnabled(false);

        MockHttpServletRequest req = new MockHttpServletRequest("POST", "/mcp");
        req.setRequestURI("/mcp");
        req.addHeader("X-Tenant-Id", "tenant-abc");
        MockHttpServletResponse resp = new MockHttpServletResponse();

        // 观察 chain 中 ThreadLocal 的状态(filter 在 finally 中清空,所以必须在 chain 内读)
        String[] captured = new String[1];
        FilterChain observingChain = (request, response) -> captured[0] = McpTenantContext.getTenantId();

        filter.doFilter(req, resp, observingChain);

        assertThat(resp.getStatus()).isEqualTo(200);
        assertThat(captured[0]).isEqualTo("tenant-abc");
    }

    @Test
    @DisplayName("鉴权开启且 Key 缺失时返回 401,JSON-RPC 错误格式")
    void authEnabled_missingKey_returns401() throws ServletException, IOException {
        properties.setEnabled(true);
        properties.setApiKeys(List.of("valid-key"));

        MockHttpServletRequest req = new MockHttpServletRequest("POST", "/mcp");
        req.setRequestURI("/mcp");
        MockHttpServletResponse resp = new MockHttpServletResponse();
        FilterChain chain = mock(FilterChain.class);

        filter.doFilter(req, resp, chain);

        assertThat(resp.getStatus()).isEqualTo(401);
        assertThat(resp.getContentAsString()).contains("Unauthorized");
        assertThat(resp.getContentAsString()).contains("\"jsonrpc\":\"2.0\"");
        verify(chain, never()).doFilter(any(), any());
    }

    @Test
    @DisplayName("鉴权开启且 Key 错误时返回 401")
    void authEnabled_wrongKey_returns401() throws ServletException, IOException {
        properties.setEnabled(true);
        properties.setApiKeys(List.of("valid-key"));

        MockHttpServletRequest req = new MockHttpServletRequest("POST", "/mcp");
        req.setRequestURI("/mcp");
        req.addHeader("X-MCP-Key", "wrong-key");
        MockHttpServletResponse resp = new MockHttpServletResponse();
        FilterChain chain = mock(FilterChain.class);

        filter.doFilter(req, resp, chain);

        assertThat(resp.getStatus()).isEqualTo(401);
        verify(chain, never()).doFilter(any(), any());
    }

    @Test
    @DisplayName("请求结束后 ThreadLocal 必须被清空(防止线程复用泄漏)")
    void threadLocal_clearedAfterRequest() throws ServletException, IOException {
        properties.setEnabled(false);

        MockHttpServletRequest req = new MockHttpServletRequest("POST", "/mcp");
        req.setRequestURI("/mcp");
        req.addHeader("X-Tenant-Id", "tenant-leak-test");
        MockHttpServletResponse resp = new MockHttpServletResponse();
        MockFilterChain chain = new MockFilterChain();

        filter.doFilter(req, resp, chain);

        assertThat(McpTenantContext.getTenantId())
                .as("ThreadLocal must be cleared to prevent tenant leakage across thread reuse")
                .isNull();
    }

    @Test
    @DisplayName("鉴权通过后,Chain 内可观察到绑定的 tenantId(借助计数调用)")
    void authValid_chainObservedBinding() throws ServletException, IOException {
        properties.setEnabled(true);
        properties.setApiKeys(List.of("valid-key"));

        McpTenantContext.setTenantId("pre-existing"); // 模拟线程复用残留

        MockHttpServletRequest req = new MockHttpServletRequest("POST", "/mcp");
        req.setRequestURI("/mcp");
        req.addHeader("X-MCP-Key", "valid-key");
        req.addHeader("X-Tenant-Id", "tenant-xyz");
        MockHttpServletResponse resp = new MockHttpServletResponse();

        // 自定义 FilterChain:在 doFilter 中读取 ThreadLocal,验证 filter 的绑定动作已生效
        FilterChain observingChain = (request, response) -> {
            // 此时 ThreadLocal 应已被 filter 绑定
            assert McpTenantContext.getTenantId().equals("tenant-xyz")
                    : "filter should have bound tenantId before chain.doFilter";
        };

        filter.doFilter(req, resp, observingChain);

        // filter finally 段已清空
        assertThat(McpTenantContext.getTenantId()).isNull();
    }

    @Test
    @DisplayName("JSON-RPC body 中的 _meta.tenantId 也能解析(无 X-Tenant-Id header 时)")
    void jsonRpcMeta_extractsTenantId() throws ServletException, IOException {
        properties.setEnabled(false);

        MockHttpServletRequest req = new MockHttpServletRequest("POST", "/mcp");
        req.setRequestURI("/mcp");
        req.setContentType("application/json");
        req.setContent("""
                {"jsonrpc":"2.0","id":1,"method":"tools/call","params":{
                  "name":"count_devices",
                  "arguments":{},
                  "_meta":{"tenantId":"tenant-from-meta"}
                }}
                """.getBytes());
        MockHttpServletResponse resp = new MockHttpServletResponse();

        // 同样的观察技巧:在 chain 中读取 ThreadLocal
        String[] captured = new String[1];
        FilterChain observingChain = (request, response) -> captured[0] = McpTenantContext.getTenantId();

        filter.doFilter(req, resp, observingChain);

        assertThat(captured[0]).isEqualTo("tenant-from-meta");
        assertThat(McpTenantContext.getTenantId()).isNull(); // 已清空
    }

    @Test
    @DisplayName("多 Key 白名单中任一匹配即通过")
    void multipleApiKeys_anyMatchPasses() throws ServletException, IOException {
        properties.setEnabled(true);
        properties.setApiKeys(List.of("key-A", "key-B", "key-C"));

        for (String valid : List.of("key-A", "key-B", "key-C")) {
            McpTenantContext.clear();
            MockHttpServletRequest req = new MockHttpServletRequest("POST", "/mcp");
            req.setRequestURI("/mcp");
            req.addHeader("X-MCP-Key", valid);
            MockHttpServletResponse resp = new MockHttpServletResponse();
            MockFilterChain chain = new MockFilterChain();
            filter.doFilter(req, resp, chain);
            assertThat(resp.getStatus()).as("Key '%s' should pass", valid).isEqualTo(200);
        }
    }

    @Test
    @DisplayName("X-Tenant-Id header 优先级高于 JSON-RPC _meta")
    void headerPriorityOverMeta() throws ServletException, IOException {
        properties.setEnabled(false);

        MockHttpServletRequest req = new MockHttpServletRequest("POST", "/mcp");
        req.setRequestURI("/mcp");
        req.addHeader("X-Tenant-Id", "tenant-from-header");
        req.setContentType("application/json");
        req.setContent("""
                {"jsonrpc":"2.0","id":1,"method":"tools/call","params":{
                  "name":"count_devices","arguments":{},
                  "_meta":{"tenantId":"tenant-from-meta"}
                }}
                """.getBytes());
        MockHttpServletResponse resp = new MockHttpServletResponse();

        String[] captured = new String[1];
        FilterChain observingChain = (request, response) -> captured[0] = McpTenantContext.getTenantId();

        filter.doFilter(req, resp, observingChain);

        assertThat(captured[0]).isEqualTo("tenant-from-header");
    }
}
