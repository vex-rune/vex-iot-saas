# 04 · 后端规范

> 仅适用于 **后端 Java/Spring/Entity 改动**。本文件即全部规则,无外部依赖。

## 🚨 硬性红线 (违反即返工)

### 实体类命名 — 不可妥协

> 数据库实体类文件名 **必须**是 `XxxEntity.java`, **禁止**其他命名。

### 级联 — 禁止

> `@Entity` 注解 **禁止使用 `CascadeType`(任何级联)**。
>
> 原因:级联会绕过业务层校验,产生跨聚合的不一致写入。

## 核心原则 (Java 编码)

1. **代码优先清晰**,不追求花哨技巧
2. **默认不可变** — 优先 `record` + `final` 成员
3. **快速抛异常** + 明确异常信息
4. **统一命名 + 统一包目录**

## 命名规范

```java
// ✅ 类 / record:大驼峰
public class MarketService {}
public record Money(BigDecimal amount, Currency currency) {}

// ✅ 方法 / 成员:小驼峰
private final MarketRepository marketRepository;
public Market findBySlug(String slug) {}

// ✅ 常量:全大写 + 下划线
private static final int MAX_PAGE_SIZE = 100;
```

## 不可变设计

```java
// ✅ 优先 record
public record MarketDto(Long id, String name, MarketStatus status) {
}

// ✅ 或 class + final 成员 + 仅 getter
public class Market {
    private final Long id;
    private final String name;
    // 不定义 setter
}
```

## Optional 使用

```java
// ✅ find* 查询方法返回 Optional
Optional<Market> market = marketRepository.findBySlug(slug);

// ✅ 用 map/flatMap,禁止直接 .get()
return market
    .map(MarketResponse::from)
    .orElseThrow(() -> new EntityNotFoundException("未查询到对应市场数据"));
```

## Stream

- 数据转换场景用 Stream,保持调用链路简洁。
- ❌ 多层嵌套 Stream — 改普通循环。

## 异常处理

- **业务异常用非受检异常**;技术异常补上下文再包装抛出。
- 自定义业务专属异常 (如 `MarketNotFoundException`)。
- 除非统一日志或二次抛出, **禁止直接 catch 顶层 `Exception`**。
- 空 catch 块 = 必须 log / 处理 / 重抛,三者必有其一。

## 泛型与类型安全

- **禁止原生类型**,必须声明泛型参数。
- 通用工具类用有界泛型:`<T extends Identifiable> Map<Long, T> indexById(...)`。

## 代码格式

- 单文件只放一个公共顶级类/接口
- 成员排序:常量 → 成员变量 → 构造方法 → 公共方法 → 受保护方法 → 私有方法
- 方法功能单一,复杂逻辑抽工具方法

## 需规避的问题

- 参数列表过长 → 用 DTO 或 Builder
- 嵌套层级过深 → 提前返回
- 硬编码数字 → 定义具名常量
- 静态可变成员 → 优先依赖注入

## 日志

```java
private static final Logger log = LoggerFactory.getLogger(MarketService.class);
log.info("查询市场信息，标识：{}", slug);
log.error("查询市场信息失败，标识：{}", slug, ex);
```

## 空值处理

- 非必要不用 `@Nullable`,优先 `@NonNull`
- 接口入参用 Bean 校验 (`@NotNull` / `@NotBlank`)

## 测试

- JUnit 5 + AssertJ (流式断言)
- Mockito; **禁止局部 mock**
- **禁止 `Thread.sleep`** 等不稳定写法
