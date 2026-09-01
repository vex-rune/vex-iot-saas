# 修复待办

## 一、架构重构

### 1.1 废弃 PageResult，新增 Response<T>

- [ ] 废弃 `PageResult.java`
- [ ] 新增 `Response<T>` record: code 为 String，data 为泛型
- [ ] 修改 `Result.java` 或直接替换为 `Response<T>`
- [ ] 所有 Controller 返回值统一改为 `Response<T>`
- [ ] query 方法只返回 `List<T>`，count 单独接口返回 `long`

### 1.2 废弃 BaseMongoPage

- [ ] 删除 `BaseMongoPage.java`
- [ ] 所有 Controller 不再使用 BaseMongoPage

### 1.3 MongoQueriesExecutor 下沉到 Server 层

- [x] DeviceServer 新增 `query(QueriesPageRequest)` 和 `count(QueriesPageRequest)` 方法
- [x] PointTableServer 新增 `query(QueriesPageRequest)` 和 `count(QueriesPageRequest)` 方法
- [x] DeviceServer + PointTableServer 合并为 DeviceDefinitionServer
- [ ] AlarmRuleServer 新增 `query(QueriesPageRequest)` 和 `count(QueriesPageRequest)` 方法
- [ ] NotifyServer 新增 `query(QueriesPageRequest)` 和 `count(QueriesPageRequest)` 方法
- [ ] Server 层方法不调用 TenantContext.require ()

### 1.4 Controller 改造

- [ ] DeviceController: page→query, 返回 Response<List<Device>>, 新增 count 接口
- [ ] PointTableController: page→query, 返回 Response<List<PointDefinition>>, 新增 count 接口
- [ ] AlarmController: pageRules→queryRules, pageEvents→queryEvents, 新增 count 接口
- [ ] NotifyUserController: page→query, 返回 Response<List<NotifyUser>>, 新增 count 接口
- [ ] PointDataController: controlLogs→queryControlLogs, 新增 count 接口
- [ ] Controller 中移除 MongoTemplate 注入（改由 Server 层持有）

## 二、检查出的问题修复（不做租户校验）

### 2.1 高优先级

- [ ] DeviceController L44: get () 不改（用户要求不做租户校验）
- [ ] PointTableServer L68: delete (id) 不加租户校验
- [ ] AlarmRuleServer L32: delete (id) 不加租户校验
- [ ] NotifyServer L27: delete (id) 不加租户校验
- [ ] PointDataController L77: control () value 做类型校验（拒绝 Map/List/嵌套对象）

### 2.2 中优先级

- [ ] AuthController LoginReq: 加 @Valid 注解
- [ ] AlarmController ack (): TenantContext.get () 可能返回 null 导致 NPE
- [ ] SmsChannel L64: escape (message) 后 JSON 拼接可能格式错误
- [ ] AlarmEngine / DevicePointTableInitListener / NotifyDispatchServer: @Async 引用不存在的线程池 Bean → 改为不指定
  bean 名称或定义默认线程池

### 2.3 低优先级

- [ ] PointSseHub: EMITTER_TIMEOUT=0 建议改为合理超时（如 30min）
- [ ] MqttClientConfig: reconnectDelay long→int 强转溢出风险
- [ ] NotifyDispatchServer: Thread.sleep 在 @Async 线程中阻塞
- [ ] BaseMongoPage.injectTenant () 幂等但有副作用 → 随废弃一起删除

## 三、编译验证

- [ ] mvn -DskipTests clean compile 通过
