# ops-test — 测试环境依赖栈

仅提供本地/测试所需的中间件: **PostgreSQL + Redis + EMQX (MQTT Broker)**。

> **不包含 service 容器**: service 模块由开发者本地 IDE 启动, 直接连接本栈暴露的端口,
> 避免 "改一行代码 → 重建镜像 → 跑集成测试" 的迭代成本。

## 组件

| 组件 | 版本 | 端口 | 容器名 |
|---|---|---|---|
| PostgreSQL | 16-alpine | 5432 | iot-test-postgres |
| Redis | 7-alpine | 6379 | iot-test-redis |
| EMQX | 5.8 | 1883 / 8083 / 18083 | iot-test-emqx |

## 启动

```bash
# 1. 启动依赖栈
docker compose -f ops-test/docker-compose.yml up -d

# 2. 启动 service (在 IDE 里或命令行)
cd service
SPRING_PROFILES_ACTIVE=dev mvn spring-boot:run
# 或
mvn -pl service package -DskipTests
java -jar service/target/iot-saas-*.jar
```

## 停止 & 清理

```bash
# 停止容器, 保留数据卷
docker compose -f ops-test/docker-compose.yml down
# 停止并删除数据卷 (干净重置)
docker compose -f ops-test/docker-compose.yml down -v
```

## 验证

```bash
# PostgreSQL
docker exec -it iot-test-postgres psql -U postgres -d iot_saas_test -c "select version();"

# Redis
docker exec iot-test-redis redis-cli ping

# MQTT Broker
docker exec iot-test-emqx /opt/emqx/bin/emqx ping

# MQTT 业务账号 (iot / iot)
mosquitto_pub -h localhost -p 1883 -u iot -P iot -t "00601924061200038538/update" \
  -m '{"params":{"dir":"up","id":"00601924061200038538","r_data":[{"name":"data1","value":"42","err":"0"}]}}'
```

## Web 控制台

| 控制台 | 地址 | 账号 |
|---|---|---|
| EMQX Dashboard | http://localhost:18083 | admin / public |
| pgAdmin (可选) | 自行按需启动 | — |

## 对接 application-dev.yml

栈启动后, service 默认配置可直连(待 `application-dev.yml` 切到 PG 后):
```yaml
spring.datasource.url: jdbc:postgresql://localhost:5432/iot_saas_test
spring.datasource.username: postgres
spring.datasource.password: testpass
spring.data.redis.host: localhost
mqtt.broker-url: tcp://localhost:1883
mqtt.username: iot
mqtt.password: iot
```

如果修改了 PG 密码 (默认 postgres / testpass), 在 IDE 启动 service 时覆盖:
```bash
SPRING_DATASOURCE_PASSWORD=yourpwd mvn spring-boot:run
```

## 数据隔离

测试库命名规则:
- `iot_saas_test` — 测试环境默认库 (本栈)
- `iot_saas_dev` — 开发者本地直连库
- `iot_saas` — 生产库

数据卷命名 `iot-test-*` 前缀, 与生产栈 `iot-*` 隔离, 防止误删。