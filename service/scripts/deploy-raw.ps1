#!/usr/bin/env pwsh
# ============================================================
# Vex 云物联 — 直接部署脚本 (不用 Docker, Windows 版)
#
# 用法:
#   .\service\scripts\deploy-raw.ps1                    # 完整部署
#   .\service\scripts\deploy-raw.ps1 -SkipBuild         # 跳过编译
#   .\service\scripts\deploy-raw.ps1 -Env prod          # 指定环境
# ============================================================

param(
    [switch]$SkipBuild,
    [ValidateSet("dev", "prod")] [string]$Env = "prod",
    [string]$Ip = ""
)
$ErrorActionPreference = "Stop"

$SCRIPT_DIR = Split-Path -Parent $MyInvocation.MyCommand.Path
$PROJECT_ROOT = Resolve-Path (Join-Path $SCRIPT_DIR "..\..")
$SERVICE_DIR = Resolve-Path (Join-Path $SCRIPT_DIR "..")
$JAR_NAME = "iot-saas.jar"
$REMOTE_DIR = "/app/vex-iot-server"
$SSH_KEY = "$env:USERPROFILE\.ssh\id_rsa"
$SSH_OPTS = "-o StrictHostKeyChecking=no -o ConnectTimeout=10"

if ($Ip)
{
    $ECS_IP = $Ip
}
else
{
    $f = "$env:USERPROFILE\.ssh\host_ecs_ip.txt"
    if (-not (Test-Path $f))
    {
        Write-Host "[FAIL] IP 文件不存在" -Fore Red; exit 1
    }
    $ECS_IP = (Get-Content $f -Raw).Trim()
}
Write-Host "[DEPLOY] 服务器: $ECS_IP  环境: $Env  方式: 直接部署" -Fore Cyan

# Step 1: Maven 编译
if (-not $SkipBuild)
{
    Write-Host "[DEPLOY] Step 1/3: Maven 编译..." -Fore Cyan
    Push-Location $SERVICE_DIR
    & mvn clean package -DskipTests -q
    if ($LASTEXITCODE -ne 0)
    {
        Write-Host "[FAIL]" -Fore Red; exit 1
    }
    Pop-Location
    Write-Host "[  OK ] 编译成功" -Fore Green
}

$jarPath = Join-Path $SERVICE_DIR "target\$JAR_NAME"
if (-not (Test-Path $jarPath))
{
    Write-Host "[FAIL] JAR 不存在: $jarPath" -Fore Red; exit 1
}

# Step 2: 传输
Write-Host "[DEPLOY] Step 2/3: 传输 JAR..." -Fore Cyan
$jarSize = [math]::Round((Get-Item $jarPath).Length / 1MB, 1)
Write-Host "  📦 传输 ${jarSize} MB → ${ECS_IP}:${REMOTE_DIR}/" -Fore Cyan
& ssh -i $SSH_KEY $SSH_OPTS root@$ECS_IP "mkdir -p $REMOTE_DIR/logs"
& scp -i $SSH_KEY $SSH_OPTS $jarPath "root@${ECS_IP}:${REMOTE_DIR}/vex-iot-server.jar"
Write-Host "[  OK ] 传输完成" -Fore Green

# Step 3: 重启
Write-Host "[DEPLOY] Step 3/3: 重启服务..." -Fore Cyan
$remoteCmd = @"
set -e
cd /app/vex-iot-server
PID=\$( pgrep -f "vex-iot-server.jar" || true )
if [[ -n "\$PID" ]]; then
    echo "停止旧进程 (PID: \$PID)..."
    kill "\$PID" 2>/dev/null || true
    sleep 2
    kill -9 "\$PID" 2>/dev/null || true
fi
echo "启动新进程..."
nohup java -Xms512m -Xmx1024m -XX:+UseG1GC \
  -Dspring.profiles.active=$Env \
  -DPG_PASSWORD=vex_postgres_OIAUSDF123LHJK907 \
  -DJWT_SECRET=vex_secret_SDFI3123FOUSDFWERFID8 \
  -DMIMO_API_KEY="\${MIMO_API_KEY:-}" \
  -jar vex-iot-server.jar \
  > logs/startup.log 2>&1 &
sleep 8
PID=\$( pgrep -f "vex-iot-server.jar" || true )
[[ -n "\$PID" ]] && echo "✅ 进程已启动 (PID: \$PID)" || echo "⚠️  进程未启动，查看日志: tail -50 logs/startup.log"
for i in 1 2 3 4 5; do
  CODE=\$( curl -s -o /dev/null -w '%{http_code}' http://localhost:18083/actuator/health 2> /dev/null || echo 000 )
  [[ "\$CODE" == "200" ]] && echo "✅ 服务启动成功" && exit 0
  echo "  等待中... (\$i/5)"
  sleep 3
done
echo "⚠️  查看日志: tail -50 logs/startup.log"
"@
& ssh -i $SSH_KEY $SSH_OPTS root@$ECS_IP $remoteCmd

Write-Host ""
Write-Host "[  OK ] 部署完成! http://${ECS_IP}:18083" -Fore Green
Write-Host "[  OK ] 日志: ${REMOTE_DIR}/logs/startup.log" -Fore Green
