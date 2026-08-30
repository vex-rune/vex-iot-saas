# Vex 云物联 - Spring Boot 镜像
FROM eclipse-temurin:21-jre-jammy

WORKDIR /app

# 构建产物由 CI 拷贝进镜像
COPY service/target/iot-saas.jar /app/iot-saas.jar

EXPOSE 8080

ENV JAVA_OPTS="-Xms512m -Xmx1024m -XX:+UseG1GC"

ENTRYPOINT ["sh", "-c", "exec java $JAVA_OPTS -jar /app/iot-saas.jar"]