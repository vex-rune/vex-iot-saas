#!/usr/bin/env bash
# ============================================================
# Vex 云物联 — 一键构建 & 部署脚本 (跨平台)
#
# 用法:
#   bash scripts/deploy.sh                 # 完整流程
#   bash scripts/deploy.sh --skip-build    # 跳过编译
#   bash scripts/deploy.sh --env prod      # 指定环境
#   bash scripts/deploy.sh --ip 1.2.3.4    # 覆盖服务器IP
#
# 兼容: Linux / macOS / Windows(Git Bash/WSL)
# ============================================================

set -euo pipefail

# ─── 默认参数 ────────────────────────────────────────────────
SKIP_BUILD=false
DEPLOY_ENV="prod"
CUSTOM_IP=""

while [[ $# -gt 0 ]]; do
    case $1 in
        --skip-build) SKIP_BUILD=true; shift ;;
        --env)        DEPLOY_ENV="$2"; shift 2 ;;
        --ip)         CUSTOM_IP="$2"; shift 2 ;;
        -h|--help)
            echo "用法: $0 [--skip-build] [--env dev|prod] [--ip x.x.x.x]"
            exit 0 ;;
        *) echo "未知参数: $1"; exit 1 ;;
    esac
done

# ─── 配置 ────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
SERVICE_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

APP_NAME="iot-saas"
IMAGE_NAME="vex/${APP_NAME}"
JAR_NAME="${APP_NAME}.jar"
CONTAINER="iot-service"
HOST_PORT="10083"
CONTAINER_PORT="8080"
REMOTE_DIR="/opt/iot-saas"

# SSH 配置
if [[ -n "$CUSTOM_IP" ]]; then
    ECS_IP="$CUSTOM_IP"
elif [[ -f "$HOME/.ssh/host_ecs_ip.txt" ]]; then
    ECS_IP="$(cat "$HOME/.ssh/host_ecs_ip.txt" | tr -d '[:space:]')"
else
    echo "❌ 服务器 IP 未配置"; echo "   创建 ~/.ssh/host_ecs_ip.txt 写入 IP"; exit 1
fi

SSH_KEY="$HOME/.ssh/id_rsa"
SSH_OPTS="-o StrictHostKeyChecking=no -o ConnectTimeout=10"

# ─── 工具函数 ────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; CYAN='\033[0;36m'; NC='\033[0m'
log()  { echo -e "${CYAN}[DEPLOY]${NC} $1"; }
ok()   { echo -e "${GREEN}[  OK ]${NC} $1"; }
fail() { echo -e "${RED}[FAIL]${NC} $1"; exit 1; }

remote() { ssh -i "$SSH_KEY" $SSH_OPTS root@"$ECS_IP" "$@"; }

# ─── 检查依赖 ────────────────────────────────────────────────
for cmd in docker ssh scp mvn; do
    command -v $cmd &>/dev/null || fail "缺少命令: $cmd"
done
[[ -f "$SSH_KEY" ]] || fail "SSH 私钥不存在: $SSH_KEY"

log "目标服务器: $ECS_IP"
log "部署环境:   $DEPLOY_ENV"
echo ""

# ============================================================
# Step 1: Maven 编译打包
# ============================================================
if [[ "$SKIP_BUILD" == "false" ]]; then
    log "Step 1/4: Maven 编译打包..."
    cd "$SERVICE_DIR"
    mvn clean package -DskipTests -q
    [[ -f "target/$JAR_NAME" ]] || fail "JAR 未生成: target/$JAR_NAME"
    JAR_SIZE=$(du -h "target/$JAR_NAME" | cut -f1)
    ok "编译成功 ($JAR_SIZE)"
    cd "$PROJECT_ROOT"
else
    log "Step 1/4: 跳过编译"
fi

# ============================================================
# Step 2: 构建 Docker 镜像
# ============================================================
log "Step 2/4: 构建 Docker 镜像..."
DOCKERFILE="$PROJECT_ROOT/service/scripts/Dockerfile"
docker build -t "${IMAGE_NAME}:latest" -f "$DOCKERFILE" "$PROJECT_ROOT"
ok "镜像构建成功"

# ============================================================
# Step 3: 导出 & 传输
# ============================================================
log "Step 3/4: 传输镜像到 $ECS_IP ..."

# 兼容 Windows(Git Bash) 和 Linux/macOS 的临时文件路径
if [[ -n "${TEMP:-}" ]]; then
    TAR_FILE="${TEMP}/vex-iot-saas-latest.tar"
elif [[ -n "${TMPDIR:-}" ]]; then
    TAR_FILE="${TMPDIR}/vex-iot-saas-latest.tar"
else
    TAR_FILE="/tmp/vex-iot-saas-latest.tar"
fi
REMOTE_TAR="/tmp/vex-iot-saas-latest.tar"
docker save "${IMAGE_NAME}:latest" -o "$TAR_FILE"
TAR_SIZE=$(du -h "$TAR_FILE" | cut -f1)
ok "镜像导出 ($TAR_SIZE)"

scp -i "$SSH_KEY" $SSH_OPTS "$TAR_FILE" "root@${ECS_IP}:${REMOTE_TAR}"
rm -f "$TAR_FILE"
ok "传输完成"

# ============================================================
# Step 4: 远程部署
# ============================================================
log "Step 4/4: 服务器部署..."

remote bash -s <<REMOTE_EOF
set -e
TAR="/tmp/vex-iot-saas-latest.tar"

echo "--- 加载镜像 ---"
docker load -i "\$TAR"
rm -f "\$TAR"

echo "--- 停止旧容器 ---"
docker stop ${CONTAINER} 2>/dev/null || true
docker rm ${CONTAINER} 2>/dev/null || true

echo "--- 启动新容器 ---"
docker run -d \
    --name ${CONTAINER} \
    --restart unless-stopped \
    --network host \
    -e JAVA_OPTS="-Xms512m -Xmx1024m -XX:+UseG1GC" \
    -e SPRING_PROFILES_ACTIVE=${DEPLOY_ENV} \
    -e PG_PASSWORD=${PG_PASSWORD:-} \
    -e JWT_SECRET=${JWT_SECRET:-} \
    -e MIMO_API_KEY="${MIMO_API_KEY:-}" \
    ${IMAGE_NAME}:latest

echo "--- 等待启动 ---"
sleep 5

echo "--- 容器状态 ---"
docker ps --filter "name=${CONTAINER}" --format "table {{.ID}}\t{{.Status}}\t{{.Ports}}"

echo "--- 健康检查 ---"
for i in 1 2 3 4 5; do
    CODE=\$(curl -s -o /dev/null -w '%{http_code}' http://localhost:${HOST_PORT}/actuator/health 2>/dev/null || echo "000")
    if [[ "\$CODE" == "200" ]]; then
        echo "✅ 服务启动成功 (HTTP \$CODE)"
        exit 0
    fi
    echo "  等待中... (\$i/5, HTTP \$CODE)"
    sleep 3
done
echo "⚠️  服务可能仍在启动中，运行 docker logs ${CONTAINER} 查看"
REMOTE_EOF

ok "=========================================="
ok "部署完成！"
ok "服务地址: http://${ECS_IP}:${HOST_PORT}"
ok "容器名称: ${CONTAINER}"
ok "=========================================="
