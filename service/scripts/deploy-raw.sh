#!/usr/bin/env bash
# ============================================================
# Vex 云物联 — 直接部署脚本 (不用 Docker)
#
# 用法:
#   bash service/scripts/deploy-raw.sh                 # 完整流程
#   bash service/scripts/deploy-raw.sh --skip-build    # 跳过编译
#   bash service/scripts/deploy-raw.sh --env prod      # 指定环境
#   bash service/scripts/deploy-raw.sh --ip 1.2.3.4    # 覆盖服务器IP
#
# 流程: Maven 编译 → SCP 传输 JAR → SSH 远程重启
# ============================================================

set -euo pipefail

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
JAR_NAME="${APP_NAME}.jar"
REMOTE_DIR="/app/vex-iot-server"
SERVICE_NAME="vex-iot-server"

if [[ -n "$CUSTOM_IP" ]]; then
    ECS_IP="$CUSTOM_IP"
elif [[ -f "$HOME/.ssh/host_ecs_ip.txt" ]]; then
    ECS_IP="$(cat "$HOME/.ssh/host_ecs_ip.txt" | tr -d '[:space:]')"
else
    echo "❌ 服务器 IP 未配置"; exit 1
fi

SSH_KEY="$HOME/.ssh/id_rsa"
SSH_OPTS="-o StrictHostKeyChecking=no -o ConnectTimeout=10"

RED='\033[0;31m'; GREEN='\033[0;32m'; CYAN='\033[0;36m'; NC='\033[0m'
log()  { echo -e "${CYAN}[DEPLOY]${NC} $1"; }
ok()   { echo -e "${GREEN}[  OK ]${NC} $1"; }
fail() { echo -e "${RED}[FAIL]${NC} $1"; exit 1; }

remote() { ssh -i "$SSH_KEY" $SSH_OPTS root@"$ECS_IP" "$@"; }

# ─── 检查依赖 ────────────────────────────────────────────────
for cmd in ssh scp mvn; do
    command -v $cmd &>/dev/null || fail "缺少命令: $cmd"
done
[[ -f "$SSH_KEY" ]] || fail "SSH 私钥不存在: $SSH_KEY"

log "目标服务器: $ECS_IP"
log "部署环境:   $DEPLOY_ENV"
log "部署方式:   直接部署 (无 Docker)"
echo ""

# ============================================================
# Step 1: Maven 编译打包
# ============================================================
if [[ "$SKIP_BUILD" == "false" ]]; then
    log "Step 1/3: Maven 编译打包..."
    cd "$SERVICE_DIR"
    mvn clean package -DskipTests -q
    [[ -f "target/$JAR_NAME" ]] || fail "JAR 未生成: target/$JAR_NAME"
    JAR_SIZE=$(du -h "target/$JAR_NAME" | cut -f1)
    ok "编译成功 ($JAR_SIZE)"
    cd "$PROJECT_ROOT"
else
    log "Step 1/3: 跳过编译"
    [[ -f "$SERVICE_DIR/target/$JAR_NAME" ]] || fail "JAR 不存在: $SERVICE_DIR/target/$JAR_NAME"
fi

JAR_PATH="$SERVICE_DIR/target/$JAR_NAME"

# ============================================================
# Step 2: 传输 JAR 到服务器
# ============================================================
log "Step 2/3: 传输 JAR 到 $ECS_IP ..."
remote "mkdir -p $REMOTE_DIR/logs"
JAR_SIZE=$(du -h "$JAR_PATH" | cut -f1)
echo -e "  📦 文件大小: $JAR_SIZE"
scp -v -i "$SSH_KEY" $SSH_OPTS "$JAR_PATH" "root@${ECS_IP}:${REMOTE_DIR}/vex-iot-server.jar" 2>&1 | grep -iE "(sent|received|transferred|[0-9]+%|total)" || true
ok "传输完成"

# ============================================================
# Step 3: 远程重启服务
# ============================================================
log "Step 3/3: 重启服务..."

remote bash -s <<REMOTE_EOF
set -e
cd $REMOTE_DIR

# 杀掉旧进程
PID=\$(pgrep -f "vex-iot-server.jar" || true)
if [[ -n "\$PID" ]]; then
    echo "停止旧进程 (PID: \$PID)..."
    kill "\$PID" 2>/dev/null || true
    sleep 2
    kill -9 "\$PID" 2>/dev/null || true
fi

echo "启动新进程..."
nohup java \\
    -Xms512m -Xmx1024m \\
    -XX:+UseG1GC \\
    -Dspring.profiles.active=${DEPLOY_ENV} \\
    -DPG_PASSWORD=vex_postgres_OIAUSDF123LHJK907 \\
    -DJWT_SECRET=vex_secret_SDFI3123FOUSDFWERFID8 \\
    -DMIMO_API_KEY="\${MIMO_API_KEY:-}" \\
    -jar vex-iot-server.jar \\
    > /app/vex-iot-server/logs/startup.log 2>&1 &

echo "等待启动..."
sleep 8

PID=\$(pgrep -f "vex-iot-server.jar" || true)
if [[ -n "\$PID" ]]; then
    echo "✅ 进程已启动 (PID: \$PID)"
else
    echo "⚠️  进程未检测到，请查看日志: tail -50 /app/vex-iot-server/logs/startup.log"
    exit 1
fi

echo "--- 健康检查 ---"
for i in 1 2 3 4 5; do
    CODE=\$(curl -s -o /dev/null -w '%{http_code}' http://localhost:18083/actuator/health 2>/dev/null || echo "000")
    if [[ "\$CODE" == "200" ]]; then
        echo "✅ 服务启动成功 (HTTP \$CODE)"
        exit 0
    fi
    echo "  等待中... (\$i/5, HTTP \$CODE)"
    sleep 3
done
echo "⚠️  请手动检查: tail -50 /app/vex-iot-server/logs/startup.log"
REMOTE_EOF

ok "=========================================="
ok "部署完成！"
ok "服务地址: http://${ECS_IP}:18083"
ok "日志路径: ${REMOTE_DIR}/logs/startup.log"
ok "=========================================="
