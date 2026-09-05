# Vex IoT 后端编码规则指南

> 本文档基于 `iot-saas` 项目实际代码，记录所有**必须遵守的约定**和**与常见 Spring Boot 项目不同的地方**。
> 带 ⚡ 标记的是本项目**独有特色**，AI 生成代码时特别容易搞错的地方。

---

## 一、技术栈锁定

| 项 | 版本 | 备注 |
|---|------|------|
| Java | 21 | 启用 `record`、`sealed`、`switch` 表达式等特性 |
| Spring Boot | 3.3.4 | Jakarta EE 命名空间（`jakarta.persistence.*`） |
| Hibernate | 6.x | 内置于 Spring Boot 3.x，支持 `@JdbcTypeCode(SqlTypes.JSON)` |
| PostgreSQL | 16 | JSONB 列、`timestamptz`、正则匹配 |
| Lombok | 1.18.42 | `@SuperBuilder` 支持继承 builder |
| JWT | jjwt 0.12.6 | |
| 工具库 | hutool 5.8.32 | `IdUtil.getSnowflake()` 雪花 ID 生成 |

---

## 二、项目结构

```
com.vex.iot
├── api/           # 入口层
│   ├── http/      # REST API Controller
│   ├── sse/       # SSE 推送（SseController + SsePusher）
│   └── mqtt/      # MQTT 消息处理
├── app/           # 应用层（编排/认证/广播）
│   ├── auth/      # Spring Security 全套（config/filter/handler/util/model）
│   └── mqtt/      # MQTT 协议层
├── common/        # 基础设施（全项目共享）
│   ├── config/    # Spring @Configuration
│   ├── constants/ # 常量（final class + static final）
│   ├── enums/     # 枚举
│   ├── exception/ # 异常体系
│   ├── model/     # 基类（BaseEntity / TenantBaseEntity）
│   ├── queries/   # 通用查询框架
│   ├── response/  # 统一响应体 Response<T>
│   ├── security/  # 密码等安全工具
│   └── util/      # 工具类
└── domain/        # 领域层（每个子域独立目录）
    ├── alarm/     # 告警
    ├── audit/     # 审计
    ├── dashboard/ # 仪表盘
    ├── data/      # 数据
    ├── device/    # 设备
    ├── event/     # 领域事件接口 IEvent
    ├── identity/  # 身份（账号/租户/中间表）
    ├── notify/    # 通知
    └── schedule/  # 调度
```

每个子域下固定结构：

```
domain/{子域}/
├── {Domain}Service.java     # 应用服务（业务逻辑入口）
├── event/                   # 领域事件
├── exception/               # 子域专属异常（继承 BizException）
├── model/                   # 实体
└── repository/              # Spring Data Repository
```

---

## 三、实体设计 ⚡

### 3.1 双层基类体系

⚠️ **与常见项目的区别**：不是单个 `BaseEntity`，而是 **`BaseEntity` + `TenantBaseEntity`** 两层继承。

```
BaseEntity                    ← 所有实体共享：审计字段 + 软删除
  └── TenantBaseEntity        ← 业务实体额外：tenantId
        ├── AccountEntity
        ├── DeviceEntity
        ├── DataEntity
        └── ...
```

**继承规则**：
- 需要 `tenantId` 的业务实体 → 继承 `TenantBaseEntity`
- 不需要 `tenantId` 的实体（如 `TenantEntity` 本身、跨租户关联表 `SysTenantAccountEntity`）→ 继承 `BaseEntity`

```java
// ✅ 有租户归属的业务实体
public class DeviceEntity extends TenantBaseEntity { ... }

// ✅ 租户本身（自己就是租户，不需要 tenantId）
public class TenantEntity extends BaseEntity { ... }

// ✅ 跨租户关联表
public class SysTenantAccountEntity extends BaseEntity { ... }
```

### 3.2 时间字段全部用 `Instant` ⚡

⚠️ **与常见项目的区别**：**不用 `LocalDateTime`**。所有时间字段统一为 `java.time.Instant`（UTC），DB 列类型为 `timestamptz`。

```java
private Instant createdAt;
private Instant updatedAt;
private Instant triggeredAt;
private Instant timestamp;
```

Jackson 序列化输出 ISO 8601 UTC 字符串（带 `Z`），由 `JacksonConfig` 全局控制，不需要在每个字段上加 `@JsonFormat`。

### 3.3 雪花 ID 自动生成 ⚡

⚠️ **与常见项目的区别**：不用 `@GeneratedValue`，用**自定义注解 `@SnowflakeId`** + `@EntityListeners(SnowflakeIdListener.class)`。

```java
@Id
@SnowflakeId
private String id;
```

**ID 格式**：`前缀_雪花号`（如 `DEV_1820641234567890123`）

**前缀规则**：
- 类名 ≥ 3 字符 → 取前 3 位大写（`DeviceEntity` → `DEV`）
- 类名 < 3 字符 → 全小写
- 可自定义：`@SnowflakeId("CUSTOM")`

**子类不需要手动设置 ID**，`SnowflakeIdListener` 在 `@PrePersist` 阶段自动填充。手动设置后不会覆盖。

### 3.4 审计字段由方法驱动 ⚡

⚠️ **与常见项目的区别**：**不在 `@PrePersist/@Update` 自动填充 `createdAt/updatedAt`**，而是通过调用 `stampCreated()` / `stampUpdated()` / `markDeleted()` 方法显式设置。

```java
// Service 层标准写法：
Instant now = Instant.now();
String operator = UserContext.username().orElse(TenantBaseEntity.SYSTEM_USER_ID);

if (entity.getId() == null || entity.getId().isBlank()) {
    entity.stampCreated(operator, now);   // createdAt + updatedAt + state=0 + tenantId默认
} else {
    entity.stampUpdated(operator, now);   // 只更新 updatedAt + updateId
}
```

**为什么要这样做**：`@PrePersist` 无法获取当前用户（异步线程 `UserContext` 为空）。Service 层可以显式传入操作者 ID。

### 3.5 软删除用 `state` 字段 ⚡

```java
@Column(name = "state")
private Integer state;  // 0=正常, -1=软删除
```

- 常量：`DataState.NORMAL = 0`，`DataState.DELETED = -1`
- 软删除调用 `markDeleted(operator, now)`，设置 `state=-1`
- 查询时业务层自行过滤 `state != -1`（**没有全局拦截器**自动过滤）
- 判断：`entity.isDeleted()` → `state != null && state == DataState.DELETED`

### 3.6 实体注解顺序

```java
@EqualsAndHashCode(callSuper = true)   // ⚡ 必须 callSuper = true（Lombok 继承问题）
@Data
@SuperBuilder                           // ⚡ 必须用 @SuperBuilder（支持父类字段 builder）
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "xxx")
public class XxxEntity extends TenantBaseEntity {
    @Id
    @SnowflakeId
    private String id;

    @Size(max = 64)
    @Column(length = 64)
    private String deviceId;

    // ...
}
```

---

## 四、统一查询框架 ⚡

⚠️ **与常见项目的区别**：不是每个接口写一套查询 DTO，而是用**统一的 `QueriesPageRequest` + `JpaQueriesExecutor`**。

### 4.1 请求体结构

```json
{
  "predicate": {
    "and": [
      { "condition": { "field": "deviceId", "op": "eq", "value": "xxx" } },
      { "condition": { "field": "timestamp", "op": "gte", "value": "2026-09-03T00:00:00Z" } }
    ]
  },
  "page": { "page": 0, "size": 200 },
  "order": [{ "field": "timestamp", "order": "DESC" }]
}
```

### 4.2 支持的操作符

| 操作符 | 说明 |
|--------|------|
| `eq` | 等于 |
| `ne` | 不等于 |
| `gt` / `gte` / `lt` / `lte` | 大于 / 大于等于 / 小于 / 小于等于 |
| `like` | SQL LIKE（自动加 `%`） |
| `exp` | 正则匹配（PostgreSQL `regexp_like`） |
| `in` | IN 集合 |
| `isNull` / `isNotNull` | 空值判断 |

### 4.3 Service 层用法

```java
public List<DeviceEntity> queryDevices(QueriesPageRequest req) {
    return JpaQueriesExecutor.of(DeviceEntity.class, entityManager).page(req);
}

public long countDevices(QueriesPageRequest req) {
    return JpaQueriesExecutor.of(DeviceEntity.class, entityManager)
            .count(req != null ? req.getPredicate() : null);
}
```

### 4.4 Controller 层统一用 `POST /query` + `POST /count`

```java
@PostMapping("/query")
public Response<List<DeviceEntity>> query(@Valid @RequestBody QueriesPageRequest req) {
    return Response.ok(deviceService.queryDevices(req));
}

@PostMapping("/count")
public Response<Long> count(@Valid @RequestBody QueriesPageRequest req) {
    return Response.ok(deviceService.countDevices(req));
}
```

---

## 五、统一响应体 ⚡

```java
public record Response<T>(String code, String message, T data) implements Serializable {
    public static <T> Response<T> ok()           { return new Response<>("ok", "成功", null); }
    public static <T> Response<T> ok(T data)     { return new Response<>("ok", "成功", data); }
    public static <T> Response<T> fail(String code, String message) {
        return new Response<>(code, message, null);
    }
}
```

⚠️ **与常见项目的区别**：**所有 API 响应都是 HTTP 200**，业务状态通过 `code` 区分。

前端判断逻辑：
```ts
if (envelope.code === "ok") → 成功
else → 失败（根据 code 分类处理）
```

**错误码约定**：

| code | 含义 |
|------|------|
| `ok` | 成功 |
| `bad_request` | 参数错误 |
| `not_found` | 资源不存在 |
| `conflict` | 冲突（如重复创建） |
| `unauthorized` | 未登录 |
| `forbidden` | 无权限 |
| `internal_error` | 系统内部错误 |

---

## 六、异常体系

### 6.1 三层结构

```
BizException（抽象基类，禁止直接 new）
├── BusinessExceptions.BadRequestException    通用
├── BusinessExceptions.NotFoundException      通用
├── BusinessExceptions.ConflictException      通用
├── BusinessExceptions.UnauthorizedException  通用
├── BusinessExceptions.ForbiddenException     通用
├── BusinessExceptions.InternalException      通用
└── 各子域专属异常（如 DeviceNotFoundException、AlarmRuleNotFoundException）
```

### 6.2 基类定义

```java
public abstract class BizException extends RuntimeException {
    private final String code;
    protected BizException(String code, String msg) { super(msg); this.code = code; }
    public String getCode() { return code; }
}
```

### 6.3 子域专属异常写法

```java
// domain/device/exception/DeviceNotFoundException.java
public class DeviceNotFoundException extends BizException {
    public static final String CODE = "device_not_found";
    public DeviceNotFoundException() {
        super(CODE, "设备不存在");
    }
}
```

---

## 七、用户上下文 ⚡

⚠️ **与常见项目的区别**：**所有 getter 返回 `Optional`**，不返回 null。

```java
UserContext.current()   // Optional<CurrentUser>
UserContext.username()  // Optional<String>
UserContext.tenantId()  // Optional<String>
UserContext.userId()    // Optional<String>
```

**标准使用模式**：
```java
String operator = UserContext.username().orElse(TenantBaseEntity.SYSTEM_USER_ID);
```

**异步任务传递**：`@Async` 线程池无法访问 `ThreadLocal`，必须用 `runWith()`：
```java
CurrentUser cu = UserContext.current().orElse(null);
executor.submit(() -> UserContext.runWith(cu, () -> {
    // 异步逻辑，UserContext 可见
    doSomething();
}));
```

---

## 八、安全认证 ⚡

### 8.1 三种 Provider 路由

⚠️ **与常见项目的区别**：**不是一套认证逻辑**，通过 `loginType` 路由到不同的 `AuthenticationProvider`。

| loginType | Provider | 凭证 |
|-----------|----------|------|
| `USER` | `UserAuthenticationProvider` | 用户名 + 密码（salt 签名） |
| `ADMIN` | `AdminAuthenticationProvider` | 用户名 + TOTP 动态码 |
| `REFRESH` | `UserRefreshTokenAuthenticationProvider` | refresh token + 可选 targetTenantId |

三条路径统一走 `POST /api/auth/login`，由 `AuthApp.login()` 根据 `loginType` 构造不同的 `Authentication` 对象，交给 `AuthenticationManager` 路由。

### 8.2 JWT Filter 的 `shouldNotFilter` 精确白名单 ⚡

⚠️ **与常见项目的区别**：不是 `path.startsWith("/api/auth")` 全部跳过。

```java
@Override
protected boolean shouldNotFilter(HttpServletRequest req) {
    String path = req.getRequestURI();
    // 只跳过这两个端点
    if ("POST".equalsIgnoreCase(req.getMethod()) && "/api/auth/login".equals(path)) return true;
    if ("GET".equalsIgnoreCase(req.getMethod()) && "/api/auth/key-info".equals(path)) return true;
    return false;  // /api/auth/me、/api/auth/tenants 等都走 JWT 过滤器
}
```

### 8.3 错误消息收敛

登录/刷新 token 失败统一抛 `InvalidCredentialException("账号或凭证不正确")`，不暴露细粒度原因（防枚举攻击）。

---

## 九、领域事件 ⚡

### 9.1 IEvent 接口

⚠️ **与常见项目的区别**：不是 record 类，而是 **`IEvent<T>` 泛型接口 + 内嵌 `Metadata` record**。

```java
public interface IEvent<T> {
    Metadata getMetadata();   // 跨域元数据
    T getPayload();           // 业务载荷
    default String source() { return getClass().getSimpleName(); }

    record Metadata(
        String eventId,       // 雪花 ID
        String tenantId,      // 租户
        String source,        // 事件来源
        Instant occurredAt,   // 发生时间
        String deviceId,      // 关联设备（可空）
        String pointCode,     // 关联点位（可空）
        String category       // 分类（alarm/data/device/schedule）
    ) {}
}
```

### 9.2 子域事件标记接口

每个子域定义自己的标记接口，便于 `BroadcastApp` 按类型监听：

```java
// domain/data/event/DataEvent.java
public interface DataEvent<T> extends IEvent<T> {
    String DOMAIN_SOURCE = "data-service";
}

// domain/device/event/DeviceEvent.java
public interface DeviceEvent<T> extends IEvent<T> {
    String DOMAIN_SOURCE = "device-service";
}
```

### 9.3 广播机制

`BroadcastApp` 用 `@Async @EventListener` 监听所有 `IEvent` 子类，统一通过 `SsePusher` 推送到前端。

---

## 十、审计日志

```java
@AuditLog(action = "TENANT_CREATE", resourceType = "tenant")
@PostMapping
public Response<TenantEntity> create(@Valid @RequestBody UpsertReq req) { ... }
```

`AuditAspect` 拦截 `@AuditLog` 方法，记录操作者、参数、结果，异步写入 `operation_log` 表。

**注意**：切面在主线程读取 `UserContext`（因为 `@Async` 线程池无法访问 `ThreadLocal`），显式传入 `AuditWriter`。

---

## 十一、Controller 层约定

### 11.1 标准 CRUD 端点

```java
@PostMapping("/query")      // 条件查询（QueriesPageRequest）
@PostMapping("/count")      // 数量
@GetMapping("/{id}")        // 详情
@PostMapping                // 创建
@PutMapping("/{id}")        // 更新
@DeleteMapping("/{id}")     // 删除
```

### 11.2 写操作统一加 `@AuditLog`

```java
@AuditLog(action = "ACCOUNT_TOGGLE_ENABLED", resourceType = "account")
@PutMapping("/{id}/enabled")
```

### 11.3 权限用 `@PreAuthorize`

```java
@PreAuthorize("hasRole('SUPER_ADMIN')")
@RequestMapping("/api/admin/tenants")
```

### 11.4 DTO 用 `record`

```java
public record CreateReq(
    @NotBlank String tenantId,
    @NotBlank @Size(max = 64) String username,
    @Size(max = 128) String displayName,
    @NotBlank @Size(min = 6, max = 64) String password,
    Set<String> roles
) {}
```

### 11.5 查询接口用 POST（不是 GET）

⚠️ **与常见项目的区别**：查询接口用 POST（因为请求体是 `QueriesPageRequest`），不是 GET + QueryParam。

---

## 十二、Lombok 约定

### 12.1 实体类注解顺序

```java
@EqualsAndHashCode(callSuper = true)  // ⚡ 必须 callSuper = true
@Data
@SuperBuilder                          // ⚡ 必须用 @SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "xxx")
```

### 12.2 Service / Component

```java
@Slf4j
@Service                              // 或 @Component
@RequiredArgsConstructor               // ⚡ 构造器注入，不用 @Autowired
public class XxxService { ... }
```

### 12.3 禁止 `@Autowired` 字段注入

唯一例外：`@PersistenceContext EntityManager`（JPA 规范要求）。

---

## 十三、配置约定

### 13.1 `application.yml` 分层

- `application.yml` — 通用配置（datasource, JPA, JWT, MQTT, CORS）
- `application-dev.yml` — 开发环境覆盖（DB 端口、MQTT broker）
- `application-prod.yml` — 生产环境（敏感值通过环境变量注入）

### 13.2 敏感值用 `${ENV_VAR:default}`

```yaml
jwt:
  secret: ${JWT_SECRET:dev_only_change_me_in_prod_secret_key_32b_min}
```

---

## 十四、数据库约定

| 项 | 约定 |
|----|------|
| ID 类型 | `VARCHAR(64)` + 雪花算法（`@SnowflakeId`） |
| 时间类型 | `TIMESTAMPTZ`（PostgreSQL） |
| JSON 字段 | `JSONB` 列 + `@JdbcTypeCode(SqlTypes.JSON)` |
| 软删除 | `state INTEGER`（0=正常, -1=软删） |
| 表名 | `snake_case`（如 `device_panel`、`sys_tenant_account`） |
| 列名 | `snake_case`（Hibernate 自动映射） |
| 唯一约束命名 | `uk_{表名}_{列名}`（如 `uk_point_def_device_code`） |

---

## 十五、前端交互约定

### 15.1 时间字段

- 后端序列化：`Instant` → ISO 8601 UTC 字符串（带 `Z`）
- 前端类型：`string`
- 前端解析：用 `@/lib/time.ts` 的 `parseUtcIso()` / `formatDateTime()`

### 15.2 SSE 推送

- 连接：`GET /api/sse/stream`（Bearer Token 鉴权）
- 事件名：`broadcast`（所有域事件统一一个 SSE event type）
- payload：JSON 序列化的 `IEvent` 对象
- 前端 hook：`useEventStream()` — 自动重连、自动 JSON.parse、暴露 `status`

---

## 十六、快速上手：新建子域的步骤

以"新增 `product` 子域"为例：

### 1. 实体

```java
// domain/product/model/ProductEntity.java
@EqualsAndHashCode(callSuper = true)
@Data
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "product")
public class ProductEntity extends TenantBaseEntity {

    @Id
    @SnowflakeId
    private String id;

    @Size(max = 128)
    @Column(length = 128)
    private String name;

    @Size(max = 512)
    @Column(length = 512)
    private String description;

    @Column(name = "enabled")
    private Boolean enabled;
}
```

### 2. Repository

```java
// domain/product/repository/ProductRepository.java
public interface ProductRepository extends JpaRepository<ProductEntity, String> {
}
```

### 3. 异常

```java
// domain/product/exception/ProductNotFoundException.java
public class ProductNotFoundException extends BizException {
    public static final String CODE = "product_not_found";
    public ProductNotFoundException() {
        super(CODE, "产品不存在");
    }
}
```

### 4. Service

```java
// domain/product/ProductService.java
@Slf4j
@Service
@RequiredArgsConstructor
public class ProductService {

    private final ProductRepository productRepository;
    private final EntityManager entityManager;

    public List<ProductEntity> query(QueriesPageRequest req) {
        return JpaQueriesExecutor.of(ProductEntity.class, entityManager).page(req);
    }

    public long count(QueriesPageRequest req) {
        return JpaQueriesExecutor.of(ProductEntity.class, entityManager)
                .count(req != null ? req.getPredicate() : null);
    }

    public ProductEntity save(ProductEntity product) {
        Instant now = Instant.now();
        String operator = UserContext.username().orElse(TenantBaseEntity.SYSTEM_USER_ID);
        if (product.getId() == null || product.getId().isBlank()) {
            product.stampCreated(operator, now);
        } else {
            product.stampUpdated(operator, now);
        }
        return productRepository.save(product);
    }

    public void delete(String id) {
        ProductEntity exist = productRepository.findById(id).orElse(null);
        if (exist == null) return;
        String operator = UserContext.username().orElse(TenantBaseEntity.SYSTEM_USER_ID);
        exist.markDeleted(operator, Instant.now());
        productRepository.save(exist);
    }
}
```

### 5. Controller

```java
// api/http/ProductApi.java
@RestController
@RequiredArgsConstructor
@RequestMapping("/api/products")
public class ProductApi {

    private final ProductService productService;

    @PostMapping("/query")
    public Response<List<ProductEntity>> query(@Valid @RequestBody QueriesPageRequest req) {
        return Response.ok(productService.query(req));
    }

    @PostMapping("/count")
    public Response<Long> count(@Valid @RequestBody QueriesPageRequest req) {
        return Response.ok(productService.count(req));
    }

    @GetMapping("/{id}")
    public Response<ProductEntity> get(@PathVariable String id) {
        return Response.ok(productService.findById(id));
    }

    @AuditLog(action = "PRODUCT_CREATE", resourceType = "product")
    @PostMapping
    public Response<ProductEntity> create(@Valid @RequestBody ProductEntity product) {
        return Response.ok(productService.save(product));
    }

    @AuditLog(action = "PRODUCT_UPDATE", resourceType = "product")
    @PutMapping("/{id}")
    public Response<ProductEntity> update(@PathVariable String id,
                                          @Valid @RequestBody ProductEntity product) {
        product.setId(id);
        return Response.ok(productService.save(product));
    }

    @AuditLog(action = "PRODUCT_DELETE", resourceType = "product")
    @DeleteMapping("/{id}")
    public Response<Void> delete(@PathVariable String id) {
        productService.delete(id);
        return Response.ok();
    }
}
```

---

## 十七、常见错误（AI 生成代码时特别容易犯）

| 错误 | 正确做法 |
|------|----------|
| 用 `LocalDateTime` | 用 `Instant` |
| 用 `@GeneratedValue` | 用 `@SnowflakeId` |
| 在 `@PrePersist` 自动填充审计字段 | 调用 `stampCreated/stampUpdated` |
| 用 `@Autowired` 字段注入 | 用 `@RequiredArgsConstructor` 构造器注入 |
| `path.startsWith("/api/auth")` 跳过 JWT | 精确白名单：只跳过 `/auth/login` 和 `/auth/key-info` |
| 用 GET + QueryParam 做查询 | 用 POST + `QueriesPageRequest` |
| Service 方法里 `if (xxx == null) throw new IllegalArgumentException(...)` | 用 DTO + `@NotBlank` Bean Validation |
| `catch(Exception e) { ... }` | 只 catch 具体异常类型 |
| Entity 继承 `BaseEntity` 但需要 `tenantId` | 继承 `TenantBaseEntity`（它自动带 `tenantId`） |
| `@EqualsAndHashCode(callSuper = false)` | Entity 必须 `callSuper = true` |

