#!/usr/bin/env bash
# ============================================================
# Vex 云物联 — 直接部署脚本 (不打包 Docker)
#
# 用法:
#   bash service/scripts/deploy-raw.sh                 # 完整流程
#   bash service/scripts/deploy-raw.sh --skip-build    # 跳过编译
#   bash service/scripts/deploy-raw.sh --env prod      # 指定环境
#   bash service/scripts/deploy-raw.sh --ip 1.2.3.4    # 覆盖服务器IP
#
# 流程:
#   1. Maven 编译 → gzip 压缩 JAR
#   2. rsync/sftp 上传 (压缩传输 + 进度条)
#   3. 远程解压 + 重启服务
# ============================================================

set -euo pipefail

# ─── 参数解析 ────────────────────────────────────────────────
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
        *) echo "❌ 未知参数: $1"; exit 1 ;;
    esac
done

# ─── 路径配置 ────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
SERVICE_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

APP_NAME="iot-saas"
JAR_NAME="${APP_NAME}.jar"
GZ_NAME="${APP_NAME}.jar.gz"
LOCAL_GZ="$SERVICE_DIR/target/$GZ_NAME"
LOCAL_RESTART_SH="$SCRIPT_DIR/server-restart.sh"

REMOTE_DIR="/app/vex-iot-server"
REMOTE_JAR="$REMOTE_DIR/vex-iot-server.jar"
REMOTE_RESTART_SH="$REMOTE_DIR/restart.sh"

# ─── 服务器 IP ────────────────────────────────────────────────
if [[ -n "$CUSTOM_IP" ]]; then
    ECS_IP="$CUSTOM_IP"
elif [[ -f "$HOME/.ssh/host_ecs_ip.txt" ]]; then
    ECS_IP="$(tr -d '[:space:]' < "$HOME/.ssh/host_ecs_ip.txt")"
else
    echo "❌ 服务器 IP 未配置: $HOME/.ssh/host_ecs_ip.txt"; exit 1
fi

# ─── SSH 配置 ─────────────────────────────────────────────────
SSH_KEY="$HOME/.ssh/id_rsa"
[[ -f "$SSH_KEY" ]] || { echo "❌ SSH 私钥不存在: $SSH_KEY"; exit 1; }
SSH_OPTS="-o StrictHostKeyChecking=no -o ConnectTimeout=10 -o Compression=yes"
mkdir -p "$HOME/.ssh/sockets" 2>/dev/null || true

# ─── 颜色输出 ────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; CYAN='\033[0;36m'; NC='\033[0m'
log() { echo -e "${CYAN}[DEPLOY]${NC} $1"; }
ok()  { echo -e "${GREEN}[  OK ]${NC} $1"; }
fail(){ echo -e "${RED}[FAIL]${NC} $1"; exit 1; }

remote() { ssh -i "$SSH_KEY" $SSH_OPTS root@"$ECS_IP" "$@"; }

# ─── 启动信息 ────────────────────────────────────────────────
log "目标服务器: $ECS_IP"
log "部署环境:   $DEPLOY_ENV"
log "传输工具:   sftp (zlib 压缩)"
echo ""

# ─── 上传函数: sftp (FinalShell 方式, 自带 zlib) ─────────────
upload_with_progress() {
    local LOCAL="$1"
    local REMOTE="$2"
    local DESC="$3"
    local SIZE=$(du -h "$LOCAL" | cut -f1)
    local REMOTE_PATH="$REMOTE_DIR/$(basename "$LOCAL")"

    echo "  📦 $DESC: $SIZE → $ECS_IP:$(dirname "$REMOTE_PATH")"

    # sftp 批量模式 (FinalShell 同款: zlib 压缩 + 实时进度)
    local SFTP_BATCH=$(mktemp)
    cat > "$SFTP_BATCH" <<SFTP_EOF
progress
put "$LOCAL" "$REMOTE_PATH"
bye
SFTP_EOF

    sftp -b "$SFTP_BATCH" -i "$SSH_KEY" $SSH_OPTS "root@${ECS_IP}"
    local RC=$?
    rm -f "$SFTP_BATCH"
    return $RC
}

# ============================================================
# Step 1: Maven 编译 + 压缩
# ============================================================
if [[ "$SKIP_BUILD" == "false" ]]; then
    log "Step 1/3: Maven 编译..."
    ( cd "$SERVICE_DIR" && mvn clean package -DskipTests -q )
    [[ -f "$SERVICE_DIR/target/$JAR_NAME" ]] || fail "JAR 未生成"

    # 压缩 (81MB → ~25MB)
    gzip -f "$SERVICE_DIR/target/$JAR_NAME"
    GZ_SIZE=$(du -h "$LOCAL_GZ" | cut -f1)
    ok "编译+压缩完成 ($GZ_SIZE)"
else
    log "Step 1/3: 跳过编译"
    if [[ -f "$LOCAL_GZ" ]]; then
        ok "使用已有压缩包"
    elif [[ -f "$SERVICE_DIR/target/$JAR_NAME" ]]; then
        gzip -f "$SERVICE_DIR/target/$JAR_NAME"
        ok "压缩完成"
    else
        fail "JAR 不存在: $SERVICE_DIR/target/$JAR_NAME"
    fi
fi

# ============================================================
# Step 2: 上传 JAR + restart.sh + 远程解压
# ============================================================
log "Step 2/3: 上传文件..."

# 远程准备 (单次 SSH 连接完成)
remote "mkdir -p '$REMOTE_DIR/logs'"

# 上传 JAR (.gz 格式)
upload_with_progress "$LOCAL_GZ" "$REMOTE_DIR/$GZ_NAME" "JAR"

# 上传 restart.sh
upload_with_progress "$LOCAL_RESTART_SH" "$REMOTE_RESTART_SH" "restart.sh"
remote "chmod +x $REMOTE_RESTART_SH"

# 远程解压
log "Step 2/3: 远程解压..."
remote bash -s "$REMOTE_DIR" <<'REMOTE_EOF'
set -e
cd "$1"

GZ_FILE=$(ls *.jar.gz 2>/dev/null | head -1)
if [[ -n "$GZ_FILE" ]]; then
    gunzip -f "$GZ_FILE"
    echo "  ✅ 解压: $GZ_FILE → ${GZ_FILE%.gz}"
else
    echo "  ⚠️ 未找到 .jar.gz 文件"
    ls -lh
    exit 1
fi

ls -lh *.jar
REMOTE_EOF

# ============================================================
# Step 3: 远程重启服务
# ============================================================
log "Step 3/3: 重启服务..."
remote "$REMOTE_RESTART_SH restart"

echo ""
ok "=========================================="
ok "部署完成!"
ok "服务地址: http://${ECS_IP}:10083"
ok "服务器命令:"
ok "  ssh root@${ECS_IP} '$REMOTE_RESTART_SH status'"
ok "  ssh root@${ECS_IP} '$REMOTE_RESTART_SH logs'"
ok "=========================================="