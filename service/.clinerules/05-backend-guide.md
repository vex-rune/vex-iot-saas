# 05 · 后端编码规则指南

> 仅适用于 **后端 Java/Spring/Entity 改动**。本文件即全部规则,无外部依赖。
> 带 ⚡ 标记的是本项目**独有特色**,AI 生成代码时特别容易搞错的地方。

---

## 技术栈锁定

| 项 | 版本 | 备注 |
|---|------|------|
| Java | 21 | 启用 record / sealed / switch 表达式 |
| Spring Boot | 3.3.4 | Jakarta EE 命名空间 |
| Hibernate | 6.x | `@JdbcTypeCode(SqlTypes.JSON)` |
| PostgreSQL | 16 | JSONB / timestamptz / regexp_like |
| Lombok | 1.18.42 | `@SuperBuilder` |
| JWT | jjwt 0.12.6 | |
| 工具库 | hutool 5.8.32 | `IdUtil.getSnowflake()` |

---

## 项目结构

```
com.vex.iot
├── api/           # 入口层
│   ├── http/      # REST API Controller
│   ├── sse/       # SSE 推送
│   └── mqtt/      # MQTT 消息处理
├── app/           # 应用层（编排/认证/广播）
│   ├── auth/      # Spring Security 全套
│   └── mqtt/      # MQTT 协议层
├── common/        # 基础设施
│   ├── config/    # @Configuration
│   ├── constants/ # 常量
│   ├── enums/     # 枚举
│   ├── exception/ # 异常体系
│   ├── model/     # 基类（BaseEntity / TenantBaseEntity）
│   ├── queries/   # 通用查询框架
│   ├── response/  # 统一响应体
│   ├── security/  # 密码等安全工具
│   └── util/      # 工具类
└── domain/        # 领域层（每个子域独立目录）
    ├── alarm/     # 告警
    ├── audit/     # 审计
    ├── dashboard/ # 仪表盘
    ├── data/      # 数据
    ├── device/    # 设备
    ├── event/     # 领域事件接口
    ├── identity/  # 身份（账号/租户）
    ├── notify/    # 通知
    └── schedule/  # 调度
```

每个子域固定结构:
```
domain/{子域}/
├── {Domain}Service.java
├── event/
├── exception/   # 继承 BizException
├── model/
└── repository/
```

---

## 实体设计 ⚡

### 双层基类体系

⚠️ 不是单个 BaseEntity,而是 **BaseEntity + TenantBaseEntity** 两层。

```
BaseEntity                    ← 审计字段 + 软删除
  └── TenantBaseEntity        ← 额外: tenantId
        ├── AccountEntity
        ├── DeviceEntity
        └── ...
```

继承规则:
- 需要 `tenantId` 的业务实体 → 继承 `TenantBaseEntity`
- 不需要 `tenantId`（如 `TenantEntity` 本身、跨租户关联表 `SysTenantAccountEntity`）→ 继承 `BaseEntity`

### 时间字段全部用 `Instant` ⚡

⚠️ **不用 `LocalDateTime`**。所有时间字段统一为 `java.time.Instant`（UTC），DB 列类型为 `timestamptz`。

```java
private Instant createdAt;
private Instant updatedAt;
private Instant triggeredAt;
private Instant timestamp;
```

Jackson 序列化输出 ISO 8601 UTC 字符串（带 `Z`），由 `JacksonConfig` 全局控制。

### 雪花 ID 自动生成 ⚡

⚠️ 不用 `@GeneratedValue`，用**自定义注解 `@SnowflakeId`**。

```java
@Id
@SnowflakeId
private String id;
```

ID 格式: `前缀_雪花号`（如 `DEV_1820641234567890123`）
前缀规则: 类名前 3 位大写（`DeviceEntity` → `DEV`）,可自定义: `@SnowflakeId("CUSTOM")`

### 审计字段由方法驱动 ⚡

⚠️ **不在 `@PrePersist/@Update` 自动填充**，而是调用 `stampCreated()` / `stampUpdated()` / `markDeleted()`。

```java
Instant now = Instant.now();
String operator = UserContext.username().orElse(TenantBaseEntity.SYSTEM_USER_ID);

if (entity.getId() == null || entity.getId().isBlank()) {
    entity.stampCreated(operator, now);
} else {
    entity.stampUpdated(operator, now);
}
```

### 软删除用 `state` 字段 ⚡

```java
@Column(name = "state")
private Integer state;  // 0=正常, -1=软删除
```

- 常量: `DataState.NORMAL = 0`，`DataState.DELETED = -1`
- 查询时自行过滤 `state != -1`（没有全局拦截器）
- 判断: `entity.isDeleted()`

### 实体注解顺序 ⚡

```java
@EqualsAndHashCode(callSuper = true)   // 必须 callSuper = true
@Data
@SuperBuilder                           // 必须用 @SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "xxx")
public class XxxEntity extends TenantBaseEntity {
    @Id @SnowflakeId private String id;
    // ...
}
```

---

## 统一查询框架 ⚡

⚠️ 不是每个接口写一套查询 DTO，用**统一的 `QueriesPageRequest` + `JpaQueriesExecutor`**。

请求体:
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

操作符: `eq / ne / gt / gte / lt / lte / like / exp / in / isNull / isNotNull`

Service 层:
```java
public List<DeviceEntity> query(QueriesPageRequest req) {
    return JpaQueriesExecutor.of(DeviceEntity.class, entityManager).page(req);
}
```

Controller 层: 统一用 `POST /query` + `POST /count`

---

## 统一响应体 ⚡

```java
public record Response<T>(String code, String message, T data) implements Serializable {
    public static <T> Response<T> ok(T data) { ... }
    public static <T> Response<T> fail(String code, String message) { ... }
}
```

⚠️ **所有 API 响应都是 HTTP 200**，业务状态通过 `code` 区分。
错误码: `ok / bad_request / not_found / conflict / unauthorized / forbidden / internal_error`

---

## 异常体系

```
BizException（抽象基类，禁止直接 new）
├── BusinessExceptions.BadRequestException
├── BusinessExceptions.NotFoundException
├── BusinessExceptions.ConflictException
├── BusinessExceptions.UnauthorizedException
├── BusinessExceptions.ForbiddenException
├── BusinessExceptions.InternalException
└── 各子域专属异常（如 DeviceNotFoundException）
```

子域专属异常写法:
```java
public class DeviceNotFoundException extends BizException {
    public static final String CODE = "device_not_found";
    public DeviceNotFoundException() { super(CODE, "设备不存在"); }
}
```

---

## 用户上下文 ⚡

⚠️ **所有 getter 返回 `Optional`**，不返回 null。

```java
UserContext.current()   // Optional<CurrentUser>
UserContext.username()  // Optional<String>
UserContext.tenantId()  // Optional<String>
```

标准使用:
```java
String operator = UserContext.username().orElse(TenantBaseEntity.SYSTEM_USER_ID);
```

异步传递（`@Async` 线程无法访问 ThreadLocal）:
```java
CurrentUser cu = UserContext.current().orElse(null);
executor.submit(() -> UserContext.runWith(cu, () -> doSomething()));
```

---

## 安全认证 ⚡

### 三种 Provider 路由

⚠️ 通过 `loginType` 路由到不同 `AuthenticationProvider`:

| loginType | Provider | 凭证 |
|-----------|----------|------|
| `USER` | `UserAuthenticationProvider` | 用户名 + 密码 |
| `ADMIN` | `AdminAuthenticationProvider` | 用户名 + TOTP 动态码 |
| `REFRESH` | `UserRefreshTokenAuthenticationProvider` | refresh token + 可选 targetTenantId |

统一走 `POST /api/auth/login`，由 `AuthApp.login()` 根据 `loginType` 构造不同 `Authentication`，交给 `AuthenticationManager` 路由。

### JWT Filter 白名单 ⚡

⚠️ 不是 `path.startsWith("/api/auth")` 全部跳过:
```java
// 只跳过这两个端点
if ("POST".equals(method) && "/api/auth/login".equals(path)) return true;
if ("GET".equals(method) && "/api/auth/key-info".equals(path)) return true;
return false;  // /api/auth/me 等都走 JWT 过滤器
```

### 错误消息收敛

登录/刷新失败统一抛 `InvalidCredentialException("账号或凭证不正确")`，不暴露细粒度原因。

---

## 领域事件 ⚡

⚠️ 不是 record 类，是 **`IEvent<T>` 泛型接口 + 内嵌 `Metadata` record**:

```java
public interface IEvent<T> {
    Metadata getMetadata();
    T getPayload();
    default String source() { return getClass().getSimpleName(); }

    record Metadata(
        String eventId, String tenantId, String source,
        Instant occurredAt, String deviceId, String pointCode, String category
    ) {}
}
```

子域标记接口: `DataEvent<T>`, `DeviceEvent<T>` 等。
广播: `BroadcastApp` 用 `@Async @EventListener` 监听所有 `IEvent`，统一推送到 SSE。

---

## 审计日志

```java
@AuditLog(action = "TENANT_CREATE", resourceType = "tenant")
@PostMapping
public Response<TenantEntity> create(@Valid @RequestBody UpsertReq req) { ... }
```

`AuditAspect` 拦截 `@AuditLog`，异步写入 `operation_log` 表。切面在主线程读取 `UserContext`，显式传入 `AuditWriter`。

---

## Controller 层约定

标准 CRUD 端点:
```java
@PostMapping("/query")      // 查询
@PostMapping("/count")      // 数量
@GetMapping("/{id}")        // 详情
@PostMapping                // 创建
@PutMapping("/{id}")        // 更新
@DeleteMapping("/{id}")     // 删除
```

- 写操作统一加 `@AuditLog`
- 权限用 `@PreAuthorize`
- DTO 用 `record`
- ⚠️ 查询用 POST（因为请求体是 `QueriesPageRequest`），不是 GET

---

## Lombok 约定

实体类:
```java
@EqualsAndHashCode(callSuper = true)  // 必须 callSuper = true
@Data
@SuperBuilder                          // 必须用 @SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "xxx")
```

Service / Component:
```java
@Slf4j
@Service
@RequiredArgsConstructor  // 构造器注入，不用 @Autowired
```

⚠️ 禁止 `@Autowired` 字段注入。唯一例外: `@PersistenceContext EntityManager`。

---

## 数据库约定

| 项 | 约定 |
|----|------|
| ID 类型 | `VARCHAR(64)` + 雪花算法 |
| 时间类型 | `TIMESTAMPTZ` |
| JSON 字段 | `JSONB` + `@JdbcTypeCode(SqlTypes.JSON)` |
| 软删除 | `state INTEGER`（0=正常, -1=软删） |
| 表名 | `snake_case` |
| 列名 | `snake_case`（Hibernate 自动映射） |
| 唯一约束命名 | `uk_{表名}_{列名}` |

---

## 快速上手:新建子域模板

以 `product` 子域为例:

### 1. 实体
```java
@EqualsAndHashCode(callSuper = true)
@Data @SuperBuilder @NoArgsConstructor @AllArgsConstructor
@Entity @Table(name = "product")
public class ProductEntity extends TenantBaseEntity {
    @Id @SnowflakeId private String id;
    @Size(max = 128) @Column(length = 128) private String name;
    @Size(max = 512) @Column(length = 512) private String description;
    private Boolean enabled;
}
```

### 2. Repository
```java
public interface ProductRepository extends JpaRepository<ProductEntity, String> {}
```

### 3. 异常
```java
public class ProductNotFoundException extends BizException {
    public static final String CODE = "product_not_found";
    public ProductNotFoundException() { super(CODE, "产品不存在"); }
}
```

### 4. Service
```java
@Slf4j @Service @RequiredArgsConstructor
public class ProductService {
    private final ProductRepository repo;
    private final EntityManager em;

    public List<ProductEntity> query(QueriesPageRequest req) {
        return JpaQueriesExecutor.of(ProductEntity.class, em).page(req);
    }
    public long count(QueriesPageRequest req) {
        return JpaQueriesExecutor.of(ProductEntity.class, em).count(req != null ? req.getPredicate() : null);
    }
    public ProductEntity save(ProductEntity e) {
        Instant now = Instant.now();
        String op = UserContext.username().orElse(TenantBaseEntity.SYSTEM_USER_ID);
        if (e.getId() == null || e.getId().isBlank()) e.stampCreated(op, now);
        else e.stampUpdated(op, now);
        return repo.save(e);
    }
    public void delete(String id) {
        repo.findById(id).ifPresent(e -> {
            String op = UserContext.username().orElse(TenantBaseEntity.SYSTEM_USER_ID);
            e.markDeleted(op, Instant.now());
            repo.save(e);
        });
    }
}
```

### 5. Controller
```java
@RestController @RequiredArgsConstructor @RequestMapping("/api/products")
public class ProductApi {
    private final ProductService svc;

    @PostMapping("/query") public Response<List<ProductEntity>> query(@Valid @RequestBody QueriesPageRequest req) {
        return Response.ok(svc.query(req));
    }
    @PostMapping("/count") public Response<Long> count(@Valid @RequestBody QueriesPageRequest req) {
        return Response.ok(svc.count(req));
    }
    @GetMapping("/{id}") public Response<ProductEntity> get(@PathVariable String id) {
        return Response.ok(svc.findById(id));
    }
    @AuditLog(action = "PRODUCT_CREATE", resourceType = "product")
    @PostMapping public Response<ProductEntity> create(@Valid @RequestBody ProductEntity e) {
        return Response.ok(svc.save(e));
    }
    @AuditLog(action = "PRODUCT_UPDATE", resourceType = "product")
    @PutMapping("/{id}") public Response<ProductEntity> update(@PathVariable String id, @Valid @RequestBody ProductEntity e) {
        e.setId(id);
        return Response.ok(svc.save(e));
    }
    @AuditLog(action = "PRODUCT_DELETE", resourceType = "product")
    @DeleteMapping("/{id}") public Response<Void> delete(@PathVariable String id) {
        svc.delete(id);
        return Response.ok();
    }
}
```

---

## 常见错误（AI 最容易犯）

| 错误 | 正确做法 |
|------|----------|
| 用 `LocalDateTime` | 用 `Instant` |
| 用 `@GeneratedValue` | 用 `@SnowflakeId` |
| 在 `@PrePersist` 自动填充审计字段 | 调用 `stampCreated/stampUpdated` |
| 用 `@Autowired` 字段注入 | 用 `@RequiredArgsConstructor` |
| `path.startsWith("/api/auth")` 跳过 JWT | 精确白名单:只跳过 `/auth/login` 和 `/auth/key-info` |
| 用 GET + QueryParam 做查询 | 用 POST + `QueriesPageRequest` |
| Service 里 `throw new IllegalArgumentException(...)` | 用 DTO + `@NotBlank` Bean Validation |
| `catch(Exception e) { ... }` | 只 catch 具体异常类型 |
| Entity 继承 `BaseEntity` 但需要 `tenantId` | 继承 `TenantBaseEntity` |
| `@EqualsAndHashCode(callSuper = false)` | Entity 必须 `callSuper = true` |
