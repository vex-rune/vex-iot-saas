package com.vex.iot.app.ai;

import org.springframework.boot.context.properties.ConfigurationProperties;

import java.util.ArrayList;
import java.util.List;

/**
 * MCP Server 鉴权配置。
 *
 * <p>启动时从 {@code vex.mcp.*} 读取:
 * <ul>
 *   <li>{@code enabled}:是否启用 API Key 校验,默认 false。开发环境建议设为 false,
 *       生产环境务必设为 true。</li>
 *   <li>{@code api-keys}:合法的 API Key 列表(明文)。生产建议从密钥管理服务下发,
 *       这里只做静态校验占位。</li>
 *   <li>{@code key-header}:API Key 所在的 HTTP header 名,默认
 *       {@code X-MCP-Key}。</li>
 * </ul>
 *
 * <p>注意:API Key 仅做"鉴权",不解决"该 Key 能访问哪些租户"。租户隔离仍然
 * 通过 {@link McpTenantContext#getTenantId()} 在 Tool 方法内执行
 * {@code req.withTenantFilter(tenantId)} 过滤。建议生产环境配合
 * 业务侧 Key→TenantId 映射表使用。</p>
 */
@ConfigurationProperties(prefix = "vex.mcp")
public class McpProperties {

    /**
     * 是否启用 API Key 校验
     */
    private boolean enabled = false;
    /**
     * 合法的 API Key 列表
     */
    private List<String> apiKeys = new ArrayList<>();
    /**
     * API Key 所在的 HTTP header 名
     */
    private String keyHeader = "X-MCP-Key";

    public boolean isEnabled() {
        return enabled;
    }

    public void setEnabled(boolean enabled) {
        this.enabled = enabled;
    }

    public List<String> getApiKeys() {
        return apiKeys;
    }

    public void setApiKeys(List<String> apiKeys) {
        this.apiKeys = apiKeys;
    }

    public String getKeyHeader() {
        return keyHeader;
    }

    public void setKeyHeader(String keyHeader) {
        this.keyHeader = keyHeader;
    }
}
