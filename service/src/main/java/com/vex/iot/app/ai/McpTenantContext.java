package com.vex.iot.app.ai;

/**
 * MCP 调用上下文 — 把当前 MCP 请求的租户信息绑定到 ThreadLocal,
 * 供 {@link IoTTools} 中所有 {@code @Tool} 方法统一取用,
 * 从而保证多租户隔离无需把 tenantId 作为工具方法参数暴露给 LLM。
 *
 * <p>三种来源会写入本上下文:
 * <ol>
 *   <li>Spring AI MCP Server: 通过 {@code McpTenantInterceptor} 在每次
 *       {@code tools/call} 请求进入时,从 MCP meta 中取出 tenantId 并绑定,
 *       请求结束 finally 清空。</li>
 *   <li>LangChain4j Chat: 通过 {@code LangChain4jTenantAspect} 在调用
 *       Assistant.chat(...) 之前,从 InvocationParameters 中取出 tenantId
 *       写入,调用结束后清空。</li>
 *   <li>HTTP 路径: 如未来希望把 HTTP 也并入工具层,可在 Filter 中写入。</li>
 * </ol>
 * </p>
 */
public final class McpTenantContext {

    private static final ThreadLocal<String> TENANT_ID = new ThreadLocal<>();

    private McpTenantContext() {
    }

    public static String getTenantId() {
        return TENANT_ID.get();
    }

    public static void setTenantId(String tenantId) {
        TENANT_ID.set(tenantId);
    }

    public static void clear() {
        TENANT_ID.remove();
    }
}
