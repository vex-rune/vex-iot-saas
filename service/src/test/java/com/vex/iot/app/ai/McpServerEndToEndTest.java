package com.vex.iot.app.ai;

import org.junit.jupiter.api.Disabled;
import org.junit.jupiter.api.DisplayName;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;

/**
 * MCP Server 端到端集成测试(占位,需要真实 DB + LLM 时启用)。
 *
 * <p>启用前置条件:
 * <ol>
 *   <li>本机启动 PostgreSQL (端口 15432,参见 application-test.yml)</li>
 *   <li>配置 MIMO_API_KEY 环境变量(若需触发真实 LLM 工具选择)</li>
 *   <li>移除 {@code @Disabled} 注解</li>
 * </ol>
 *
 * <p>启用后预期行为:
 * <ul>
 *   <li>Spring AI MCP Server 启动并注册 {@code /mcp} endpoint</li>
 *   <li>{@code tools/list} 返回 9 个工具(7 个查询 + 2 个写操作)</li>
 *   <li>{@code tools/call} 调用 {@code count_devices} 返回非空 list</li>
 *   <li>缺失 X-MCP-Key 返回 401(若 vex.mcp.enabled=true)</li>
 * </ul>
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@ActiveProfiles("test")
@Disabled("需要 PostgreSQL 与 LLM API Key;占位骨架,后续接 DB 后启用")
@DisplayName("MCP Server 端到端(占位)")
class McpServerEndToEndTest {
    // 占位 — 启用时添加:
    // @Autowired MockMvc mvc;
    // @Test void tools_list_returns_9_tools() { ... }
    // @Test void tools_call_count_devices() { ... }
    // @Test void unauthenticated_returns_401_when_auth_enabled() { ... }
}
