#!/usr/bin/env bash
# ============================================================
# Vex IoT 服务重启脚本 (服务器端使用)
#
# 上传到: /app/vex-iot-server/restart.sh
# 用法:
#   ./restart.sh                 # 重启服务
#   ./restart.sh start           # 启动
#   ./restart.sh stop            # 停止
#   ./restart.sh status          # 查看状态
#   ./restart.sh logs            # 实时日志
# ============================================================

set -e

APP_DIR="/app/vex-iot-server"
APP_NAME="vex-iot-server"
JAR_FILE="$APP_DIR/vex-iot-server.jar"
LOG_DIR="$APP_DIR/logs"
LOG_FILE="$LOG_DIR/startup.log"

# 环境变量 (可被外部覆盖)
export SPRING_PROFILES_ACTIVE="${SPRING_PROFILES_ACTIVE:-prod}"
export PG_PASSWORD="${PG_PASSWORD}"
export JWT_SECRET="${JWT_SECRET}"
# MIMO_API_KEY 从环境读取
export MIMO_API_KEY="${MIMO_API_KEY}"
export JAVA_OPTS="${JAVA_OPTS:--Xms512m -Xmx1024m -XX:+UseG1GC}"

RED='\033[0;31m'; GREEN='\033[0;32m'; CYAN='\033[0;36m'; NC='\033[0m'
log() { echo -e "${CYAN}[$(date '+%H:%M:%S')]${NC} $1"; }
ok()  { echo -e "${GREEN}[$(date '+%H:%M:%S')]${NC} $1"; }
err() { echo -e "${RED}[$(date '+%H:%M:%S')]${NC} $1"; }

get_pid() {
    pgrep -f "vex-iot-server.jar" || true
}

cmd_start() {
    mkdir -p "$LOG_DIR"
    [[ -f "$JAR_FILE" ]] || { err "JAR 不存在: $JAR_FILE"; exit 1; }

    local PID=$(get_pid)
    if [[ -n "$PID" ]]; then
        log "服务已在运行 (PID: $PID)"
        return 0
    fi

    log "启动 $APP_NAME..."
    cd "$APP_DIR"
    nohup java $JAVA_OPTS \
        -Dspring.profiles.active="$SPRING_PROFILES_ACTIVE" \
        -jar vex-iot-server.jar \
        > "$LOG_FILE" 2>&1 &

    sleep 8
    PID=$(get_pid)
    if [[ -n "$PID" ]]; then
        ok "服务已启动 (PID: $PID)"
        return 0
    else
        err "启动失败，请查看日志: tail -50 $LOG_FILE"
        return 1
    fi
}

cmd_stop() {
    local PID=$(get_pid)
    [[ -z "$PID" ]] && { log "服务未运行"; return 0; }

    log "停止服务 (PID: $PID)..."
    kill "$PID"
    sleep 3
    PID=$(get_pid)
    if [[ -n "$PID" ]]; then
        log "强制终止 (PID: $PID)"
        kill -9 "$PID"
        sleep 1
    fi
    ok "已停止"
}

cmd_restart() {
    cmd_stop
    sleep 1
    cmd_start
}

cmd_status() {
    local PID=$(get_pid)
    if [[ -n "$PID" ]]; then
        ok "运行中 (PID: $PID)"
        echo ""
        # 资源占用
        ps -p "$PID" -o pid,etime,rss,vsz,cmd 2>/dev/null || true
        echo ""
        # 健康检查
        local CODE=$(curl -s -o /dev/null -w '%{http_code}' http://localhost:10083/actuator/health 2>/dev/null || echo "000")
        if [[ "$CODE" == "200" ]]; then
            ok "健康检查: HTTP $CODE ✅"
        else
            err "健康检查: HTTP $CODE"
        fi
    else
        log "未运行"
        return 1
    fi
}

cmd_logs() {
    [[ -f "$LOG_FILE" ]] || { err "日志文件不存在"; exit 1; }
    tail -f "$LOG_FILE"
}

case "${1:-rest}" in
    start)   cmd_start ;;
    stop)    cmd_stop ;;
    restart) cmd_restart ;;
    status)  cmd_status ;;
    logs)    cmd_logs ;;
    *)       echo "用法: $0 {start|stop|restart|status|logs}"; exit 1 ;;
esac