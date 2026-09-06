#!/usr/bin/env bash
#
# 前端编译 + 打包 + 部署到 ECS 服务器
#
# 用法:
#   ./deploy.sh                    # 完整流程: 编译 → 上传 → 重载 Nginx
#   ./deploy.sh --skip-build       # 跳过编译，直接上传上次的 dist/
#   ./deploy.sh --dry-run          # 只编译不上传
#   ./deploy.sh --host 1.2.3.4     # 指定服务器 IP
#
set -euo pipefail

# ─── 颜色 ─────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[0;33m'; CYAN='\033[0;36m'; NC='\033[0m'
info()  { echo -e "${CYAN}[INFO]${NC}  $*"; }
ok()    { echo -e "${GREEN}[OK]${NC}    $*"; }
warn()  { echo -e "${YELLOW}[WARN]${NC}  $*"; }
fail()  { echo -e "${RED}[FAIL]${NC}  $*"; exit 1; }

# ─── 脚本所在目录 → app/ ──────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
APP_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$APP_DIR"

# ─── 检测用户主目录（兼容 Windows Git Bash / MSYS2 / Linux） ─────────
if [[ -n "${USERPROFILE:-}" ]]; then
    USER_HOME="$(cygpath -u "$USERPROFILE")" 2>/dev/null || USER_HOME="${USERPROFILE}"
elif [[ -n "${HOMEDRIVE:-}" && -n "${HOMEPATH:-}" ]]; then
    USER_HOME="$(cygpath -u "${HOMEDRIVE}${HOMEPATH}")" 2>/dev/null || USER_HOME="${HOMEDRIVE}${HOMEPATH}"
else
    USER_HOME="${HOME}"
fi

# ─── 参数解析 ──────────────────────────────────────────────────────────
HOST=""
SKIP_BUILD=false
DRY_RUN=false
SSH_KEY="$USER_HOME/.ssh/id_rsa"
REMOTE_PATH="/app/vex-iot"

while [[ $# -gt 0 ]]; do
    case "$1" in
        --host)        HOST="$2";       shift 2 ;;
        --skip-build)  SKIP_BUILD=true; shift   ;;
        --dry-run)     DRY_RUN=true;    shift   ;;
        --key)         SSH_KEY="$2";    shift 2 ;;
        --remote)      REMOTE_PATH="$2"; shift 2 ;;
        -h|--help)
            echo "用法: $0 [--host IP] [--skip-build] [--dry-run] [--key PATH]"
            exit 0 ;;
        *) fail "未知参数: $1" ;;
    esac
done

# ─── 1. 读取服务器 IP ─────────────────────────────────────────────────
IP_FILE="$USER_HOME/.ssh/host_ecs_ip.txt"
if [[ -z "$HOST" ]]; then
    if [[ -f "$IP_FILE" ]]; then
        HOST="$(head -1 "$IP_FILE" | tr -d '[:space:]')"
    else
        fail "未指定服务器 IP，请传参 --host x.x.x.x 或创建 $IP_FILE"
    fi
fi

info "目标服务器: $HOST"
info "部署路径:   ${HOST}:${REMOTE_PATH}"
info "SSH 密钥:   $SSH_KEY"

# ─── 2. 编译 ──────────────────────────────────────────────────────────
BUILD_TIME=0
if [[ "$SKIP_BUILD" == false ]]; then
    info "正在编译前端... (npm run build)"
    BUILD_START=$(date +%s)
    npm run build 2>&1 | sed 's/^/  /'
    [[ $? -eq 0 ]] || fail "编译失败"
    BUILD_END=$(date +%s)
    BUILD_TIME=$((BUILD_END - BUILD_START))
    ok "编译完成 (${BUILD_TIME}s)"
fi

# 检查 dist/
[[ -d "dist" ]] || fail "dist/ 目录不存在，请先运行编译（去掉 --skip-build）"

DIST_SIZE=$(du -sh dist 2>/dev/null | cut -f1)
info "dist/ 大小: $DIST_SIZE"

if [[ "$DRY_RUN" == true ]]; then
    ok "[DryRun] 仅编译，跳过上传。dist/ 已就绪。"
    exit 0
fi

# ─── 3. SSH 连通测试 ──────────────────────────────────────────────────
info "测试 SSH 连接..."
ssh -i "$SSH_KEY" -o StrictHostKeyChecking=no -o ConnectTimeout=5 \
    "root@${HOST}" "echo ok" >/dev/null 2>&1 \
    || fail "SSH 连接失败，请检查密钥和网络"
ok "SSH 连接正常"

# ─── 4. 上传 ──────────────────────────────────────────────────────────
info "上传 dist/ → ${HOST}:${REMOTE_PATH}/ ..."
UPLOAD_START=$(date +%s)

# 创建远程目录
ssh -i "$SSH_KEY" "root@${HOST}" "mkdir -p ${REMOTE_PATH}"

# SCP 上传（-r 递归, -q 安静模式）
scp -i "$SSH_KEY" -r -q -o StrictHostKeyChecking=no \
    dist/* "root@${HOST}:${REMOTE_PATH}/" 2>&1 | sed 's/^/  /' || true

UPLOAD_END=$(date +%s)
UPLOAD_TIME=$((UPLOAD_END - UPLOAD_START))
ok "上传完成 (${UPLOAD_TIME}s)"

# ─── 5. 重载 Nginx ────────────────────────────────────────────────────
info "重载 Nginx ..."
ssh -i "$SSH_KEY" "root@${HOST}" bash -s <<REMOTE_EOF
if command -v nginx >/dev/null 2>&1; then
    nginx -t 2>/dev/null && nginx -s reload 2>/dev/null && echo "Nginx reloaded" || echo "Nginx reload skipped"
else
    echo "Nginx not found, skipped"
fi
REMOTE_EOF

# ─── 完成 ──────────────────────────────────────────────────────────────
TOTAL_TIME=$((BUILD_TIME + UPLOAD_TIME))
echo ""
ok "=========================================="
ok "  部署完成!"
ok "  服务器: http://${HOST}"
ok "  大小:   $DIST_SIZE"
ok "  用时:   ${TOTAL_TIME}s"
ok "=========================================="
