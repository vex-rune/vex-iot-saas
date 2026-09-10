# IoT SaaS MCP Server 接入指南

本服务把 LangChain4j Chat 中已有的 AI 工具通过 **Spring AI MCP Server
WebMVC Streamable-HTTP** 启动器暴露为 **Model Context Protocol (MCP)**
服务端,可被 Claude Desktop / Cursor / 自研 Agent 等 MCP 客户端发现并调用。

---

## 1. 暴露的工具列表

MCP 启动器会自动扫描带 `@Tool` 注解的方法。当前共暴露 **9 个工具**(7 读 + 2 写):

| Tool 名                   | 类别      | 用途                                    |
|---------------------------|-----------|-----------------------------------------|
| `query_devices`           | 读        | 设备列表查询                            |
| `count_devices`           | 读        | 设备数量统计                            |
| `query_points`            | 读        | 点位定义查询                            |
| `query_history_data`      | 读        | 历史数据查询(按时间范围)                |
| `query_alarm_events`      | 读        | 预警事件查询                            |
| `count_alarm_events`      | 读        | 预警事件数量统计                        |
| `query_alarm_rules`       | 读        | 预警规则查询                            |
| `send_control_command`    | **写** ⚠️ | 设备点位控制下发(创建 PENDING 控制记录) |
| `acknowledge_alarm_event` | **写** ⚠️ | 预警事件人工确认                        |

> 写操作工具 (`destructiveHint=true`)的 description 中显式标注了风险,
> 提示 LLM 在用户明确指令时才调用。

---

## 2. 启动方式

服务用 Spring Boot 常规方式启动即可:

```bash
mvn spring-boot:run
# 或
java -jar target/iot-saas.jar
```

启动后,MCP 端点暴露在 `http://<host>:8080/mcp`(Streamable-HTTP,
MCP 2025-03-26+ 协议)。

---

## 3. 鉴权 (生产环境必读)

`McpTenantFilter` 内置 **API Key 鉴权**。开发时可通过配置关闭,
生产务必启用。

### 3.1 配置项

`application.yml`:

```yaml
vex:
  mcp:
    enabled: ${MCP_AUTH_ENABLED:false}      # 生产设为 true
    api-keys: ${MCP_API_KEYS:}              # 多个 Key 用逗号分隔
    key-header: X-MCP-Key
```

启动时通过环境变量注入:

```bash
export MCP_AUTH_ENABLED=true
export MCP_API_KEYS="prod-key-1,prod-key-2,prod-key-3"
java -jar target/iot-saas.jar
```

### 3.2 客户端调用示例

```bash
curl -X POST http://localhost:8080/mcp \
  -H "Content-Type: application/json" \
  -H "X-MCP-Key: prod-key-1" \
  -H "X-Tenant-Id: tenant_abc" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```

缺失或错误的 Key 会收到 **401 Unauthorized** + JSON-RPC 风格错误体:

```json
{
  "jsonrpc": "2.0",
  "error": {
    "code": -32001,
    "message": "Unauthorized: invalid or missing MCP API Key"
  },
  "id": null
}
```

> **实现细节**:API Key 比较使用 **常量时间比对**,防止时序攻击。

---

## 4. 多租户隔离 — `tenantId` 注入方式

所有工具方法都依赖 `McpTenantContext.getTenantId()` 获取当前租户,
来源由 `McpTenantFilter` 自动注入,优先级从高到低:

1. **HTTP Header (推荐)**:
   ```http
   POST /mcp HTTP/1.1
   X-Tenant-Id: tenant_abc
   ```
2. **MCP 标准 `_meta` 字段**:
   ```json
   {
     "jsonrpc": "2.0", "id": 1, "method": "tools/call",
     "params": {
       "name": "query_devices",
       "arguments": { "deviceName": "温度" },
       "_meta": { "tenantId": "tenant_abc" }
     }
   }
   ```
3. **平铺字段**(兼容):`params.tenantId`

工具方法内部走 `req.withTenantFilter(tenantId)` 自动过滤, **不会** 因 tenantId 缺失而泄露其他租户数据 (此时返回空集合)。

---

## 5. 客户端配置示例

### 5.1 Claude Desktop (`claude_desktop_config.json`)

```json
{
  "mcpServers": {
    "iot-saas": {
      "url": "http://localhost:8080/mcp",
      "headers": {
        "X-MCP-Key": "prod-key-1",
        "X-Tenant-Id": "tenant_abc"
      }
    }
  }
}
```

### 5.2 Cursor (`~/.cursor/mcp.json`)

```json
{
  "mcpServers": {
    "iot-saas": {
      "url": "http://localhost:8080/mcp",
      "transport": "streamable-http",
      "headers": {
        "X-MCP-Key": "prod-key-1",
        "X-Tenant-Id": "tenant_abc"
      }
    }
  }
}
```

### 5.3 完整 JSON-RPC 流程

```bash
# 1) initialize (获取 session)
curl -i -X POST http://localhost:8080/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -H "X-MCP-Key: prod-key-1" \
  -H "X-Tenant-Id: tenant_abc" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-03-26","capabilities":{},"clientInfo":{"name":"test","version":"1.0"}}}'

# 2) tools/list - 列出所有工具
curl -X POST http://localhost:8080/mcp \
  -H "Content-Type: application/json" \
  -H "X-MCP-Key: prod-key-1" \
  -H "X-Tenant-Id: tenant_abc" \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/list"}'

# 3) tools/call - 调用工具(查询)
curl -X POST http://localhost:8080/mcp \
  -H "Content-Type: application/json" \
  -H "X-MCP-Key: prod-key-1" \
  -H "X-Tenant-Id: tenant_abc" \
  -d '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"count_devices","arguments":{}}}'

# 4) tools/call - 调用写操作(确认预警)
curl -X POST http://localhost:8080/mcp \
  -H "Content-Type: application/json" \
  -H "X-MCP-Key: prod-key-1" \
  -H "X-Tenant-Id: tenant_abc" \
  -d '{"jsonrpc":"2.0","id":4,"method":"tools/call","params":{"name":"acknowledge_alarm_event","arguments":{"eventId":"alarm-log-123"}}}'
```

---

## 6. 与 LangChain4j Chat 共存

工具方法 (7 读 + 2 写)同时被两条调用链路复用:

- **LangChain4j Chat 路径**:`AiChatService.chat(...)` 先把
  `tenantId` 写入 `McpTenantContext`,然后调用 `Assistant.chat(...)`,
  LLM 在工具选择阶段触发 `@Tool` 方法,通过 ThreadLocal 拿到 tenantId。
- **MCP 路径**:`McpTenantFilter` 在每次 `/mcp/**` 请求进入时绑定
  ThreadLocal,工具方法在请求线程内被调用,自动获取 tenantId。

两条链路互不干扰,业务逻辑零重复。

---

## 7. 扩展:新增 MCP 工具

### 7.1 添加读操作工具

在 `IoTTools` 中添加方法:

```java
@Tool(name = "query_something", description = "...")
public List<?> querySomething(
        @ToolParam(description = "...") String param) {
    String tenantId = McpTenantContext.getTenantId();
    if (tenantId == null) return List.of();
    // ...业务逻辑
}
```

### 7.2 添加写操作工具

参考 `IoTControlTools`:

```java
@Component
@RequiredArgsConstructor
public class IoTControlTools {
    @Tool(name = "do_destructive_thing",
          description = "⚠️ 写操作,需用户确认")
    public Map<String, Object> doDestructiveThing(
            @ToolParam(description = "...") String input) {
        String tenantId = McpTenantContext.getTenantId();
        if (tenantId == null) {
            return Map.of("error", "TENANT_MISSING");
        }
        // ...写操作
    }
}
```

启动器会自动扫描 `com.vex.iot.app.ai` 包下的所有 `@Component` 类,
类内的 `@Tool` 方法会出现在 `tools/list` 中。

---

## 8. 测试覆盖

| 测试类                  | 覆盖范围                                              | 数量      |
|-------------------------|-------------------------------------------------------|-----------|
| `McpTenantFilterTest`   | 鉴权 + 租户上下文 + ThreadLocal 清理 + JSON-RPC _meta | 9         |
| `IoTControlToolsTest`   | 写操作的参数映射 / 异常路径 / tenant 缺失降级         | 5         |
| `McpServerEndToEndTest` | 占位,接 DB 后启用,做 MockMvc 端到端                   | (skipped) |

```bash
mvn test -Dtest='IoTControlToolsTest,McpTenantFilterTest'
```

输出:

```
Tests run: 14, Failures: 0, Errors: 0, Skipped: 0
BUILD SUCCESS
```

---

## 9. STDIO 模式 (可选)

如需以本地进程模式给 Claude Desktop 使用 (无 HTTP 网络):

1. 在 pom.xml 中添加依赖:
   ```xml
   <dependency>
       <groupId>org.springframework.ai</groupId>
       <artifactId>spring-ai-mcp-server-stdio-spring-boot-starter</artifactId>
   </dependency>
   ```
2. 通过 profile 切换 (`spring.profiles.active=mcp-stdio`)
3. Claude Desktop 配置改为:
   ```json
   {
     "mcpServers": {
       "iot-saas": {
         "command": "java",
         "args": ["-jar", "/path/to/iot-saas.jar", "--spring.profiles.active=mcp-stdio"]
       }
     }
   }
   ```
