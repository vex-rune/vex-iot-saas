# 代码审查待办清单(Code Review Backlog)

> 本文件由 TRAE code-review skill 输出,共 **22 项**。请按优先级逐项修复,完成后勾选。
> 生成日期: 2026-08-26

---

## 🔴 Major(8 项 — 优先修复)

- [ ] **#1** JWT 错误响应 HTTP 200 改为 401/403
  - 文件: [JwtAuthenticationFilter.java](../domain/src/main/java/com/vex/iot/security/filter/JwtAuthenticationFilter.java) / [RestAuthHandlers.java](../domain/src/main/java/com/vex/iot/security/handler/RestAuthHandlers.java) / [GlobalExceptionHandler.java](../domain/src/main/java/com/vex/iot/common/exception/GlobalExceptionHandler.java)
- [ ] **#2** `/api/auth/init-admin` 移出白名单 + 强制 bootstrap token
  - 文件: [AuthController.java](../service/src/main/java/com/vex/iot/app/http/AuthController.java) / [SecurityConfig.java](../domain/src/main/java/com/vex/iot/security/config/SecurityConfig.java)
- [ ] **#3** 点位控制无任何权限校验
  - 文件: [PointControlServer.java](../domain/src/main/java/com/vex/iot/pointcontrol/service/PointControlServer.java) / [PointControlController.java](../service/src/main/java/com/vex/iot/app/http/PointControlController.java)
- [ ] **#4** 公式引擎 Nashorn 注入风险, 改白名单 tokenizer
  - 文件: [FormulaEngine.java](../domain/src/main/java/com/vex/iot/pointcontrol/service/FormulaEngine.java)
- [ ] **#5** MQTT 启动期同步 connect 阻塞 Spring
  - 文件: [MqttClientManager.java](../service/src/main/java/com/vex/iot/app/mqtt/MqttClientManager.java)
- [ ] **#6** 设备创建 + 点表初始化无事务边界
  - 文件: [DeviceServer.java](../domain/src/main/java/com/vex/iot/device/service/DeviceServer.java) / [PointTableServer.java](../domain/src/main/java/com/vex/iot/pointtable/service/PointTableServer.java)
- [ ] **#7** MongoDB 单节点下 `@Transactional` 失效
  - 文件: [PointTableServer.java](../domain/src/main/java/com/vex/iot/pointtable/service/PointTableServer.java) + 副本集配置说明
- [ ] **#8** MQTT 回调线程 `TenantContext` 失配
  - 文件: [TenantContext.java](../domain/src/main/java/com/vex/iot/common/util/TenantContext.java) / [MqttIngestHandler.java](../service/src/main/java/com/vex/iot/app/mqtt/MqttIngestHandler.java)

## 🟡 Medium(6 项)

- [ ] **#9** `finally` 清空 SecurityContext 与 STATELESS 策略冗余
  - 文件: [JwtAuthenticationFilter.java](../domain/src/main/java/com/vex/iot/security/filter/JwtAuthenticationFilter.java)
- [ ] **#10** `@ExceptionHandler(Exception)` 兜底过宽
  - 文件: [GlobalExceptionHandler.java](../domain/src/main/java/com/vex/iot/common/exception/GlobalExceptionHandler.java)
- [ ] **#11** JWT 异常区分过期 / 无效
  - 文件: [JwtUtil.java](../domain/src/main/java/com/vex/iot/security/util/JwtUtil.java)
- [ ] **#12** `TenantContext.require()` 默认值兜底致越权风险
  - 文件: [TenantContext.java](../domain/src/main/java/com/vex/iot/common/util/TenantContext.java)
- [ ] **#13** `PointTableServer.save()` 并发查重存在竞态
  - 文件: [PointTableServer.java](../domain/src/main/java/com/vex/iot/pointtable/service/PointTableServer.java) + [PointDefinition.java](../domain/src/main/java/com/vex/iot/pointtable/model/PointDefinition.java) 唯一索引
- [ ] **#14** 分页参数无上限校验
  - 文件: [DeviceController.java](../service/src/main/java/com/vex/iot/app/http/DeviceController.java)

## 🟢 Minor(8 项)

- [ ] **#15** `loadUserByUsername` 抛 `BizException` 违反 UserDetailsService 契约
  - 文件: [LoginServer.java](../domain/src/main/java/com/vex/iot/security/service/LoginServer.java)
- [ ] **#16** `initAdmin` 角色硬编码字符串
  - 文件: [LoginServer.java](../domain/src/main/java/com/vex/iot/security/service/LoginServer.java)
- [ ] **#17** `SysUser` 用 `@Data` 暴露 `password` setter
  - 文件: [SysUser.java](../domain/src/main/java/com/vex/iot/security/model/SysUser.java)
- [ ] **#18** 登录成功将 `roles` 字段返回给前端
  - 文件: [AuthController.java](../service/src/main/java/com/vex/iot/app/http/AuthController.java)
- [ ] **#19** 点位控制请求使用 `Map<String,Object>` 弱类型
  - 文件: [PointControlController.java](../service/src/main/java/com/vex/iot/app/http/PointControlController.java)
- [ ] **#20** `@EventListener` 同步阻塞 HTTP
  - 文件: [MqttClientManager.java](../service/src/main/java/com/vex/iot/app/mqtt/MqttClientManager.java)
- [ ] **#21** 模板初始化同步阻塞 HTTP + 异常仅 warn
  - 文件: [DeviceServer.java](../domain/src/main/java/com/vex/iot/device/service/DeviceServer.java)
- [ ] **#22** `defaultValue` 经 `String.valueOf` 丢失类型
  - 文件: [PointTableServer.java](../domain/src/main/java/com/vex/iot/pointtable/service/PointTableServer.java)

---

## 修复顺序建议

1. 先修 Major 安全项(#1 ~ #5)
2. 再修 Major 一致性项(#6 ~ #8)
3. Medium 项按业务影响修
4. Minor 项集中一次性扫尾