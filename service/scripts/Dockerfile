# ============================================================
# Vex 云物联 — Spring Boot 多阶段构建 Dockerfile
#
# 用法:
#   # 方式1: 多阶段构建 (本机无需 Maven/JDK, Docker 内编译)
#   docker build -t vex/iot-saas -f service/scripts/Dockerfile .
#
#   # 方式2: 仅打包 (本机已编译好 JAR)
#   docker build -t vex/iot-saas -f service/scripts/Dockerfile --build-arg MODE=runtime .
# ============================================================

# ─── 阶段1: Maven 编译 ──────────────────────────────────────
FROM eclipse-temurin:21-jdk-jammy AS builder

WORKDIR /build

# 缓存依赖: 先复制 pom.xml, 再复制源码
COPY service/pom.xml ./pom.xml
COPY service/src ./src

# Maven 离线编译 (跳过测试)
RUN --mount=type=cache,target=/root/.m2 \
    ./mvnw -f pom.xml clean package -DskipTests -q 2>/dev/null || \
    (apt-get update -qq && apt-get install -y -qq maven > /dev/null 2>&1 && \
     mvn -f pom.xml clean package -DskipTests -q)

# ─── 阶段2: 运行时镜像 ──────────────────────────────────────
FROM eclipse-temurin:21-jre-jammy

LABEL maintainer="Vex Cloud <vex@vexrune.top>"
LABEL description="Vex 云物联 Spring Boot 服务"

# 安装 curl (健康检查用)
RUN apt-get update -qq && apt-get install -y -qq curl > /dev/null 2>&1 && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# 从 builder 阶段复制 JAR (重命名为 vex-iot-server.jar)
COPY --from=builder /build/target/iot-saas.jar ./vex-iot-server.jar

# 创建非 root 用户
RUN groupadd -r app && useradd -r -g app app && \
    chown -R app:app /app
USER app

EXPOSE 10083

# JVM 参数 (可通过环境变量覆盖)
ENV JAVA_OPTS="-Xms512m -Xmx1024m -XX:+UseG1GC -XX:+UseStringDeduplication -Djava.security.egd=file:/dev/./urandom"

# Spring 配置 (通过 docker run -e 覆盖, 无默认敏感值)
ENV SPRING_PROFILES_ACTIVE=dev

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
    CMD curl -sf http://localhost:10083/actuator/health || exit 1

ENTRYPOINT ["sh", "-c", "exec java $JAVA_OPTS -jar /app/vex-iot-server.jar"]
