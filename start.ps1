# 剧本杀排期系统启动脚本
$host.ui.RawUI.WindowTitle = "剧本杀排期系统"

Write-Host "正在启动剧本杀排期系统..." -ForegroundColor Green
Write-Host ""

Set-Location $PSScriptRoot

# 检查并安装依赖
Write-Host "检查依赖..." -ForegroundColor Yellow
$nodeModulesExists = Test-Path "node_modules"
if (-not $nodeModulesExists) {
    Write-Host "正在安装依赖，请稍候..." -ForegroundColor Yellow
    npm install
    if ($LASTEXITCODE -ne 0) {
        Write-Host "依赖安装失败，请检查网络连接" -ForegroundColor Red
        pause
        exit 1
    }
}

Write-Host ""
Write-Host "启动服务..." -ForegroundColor Green

# 启动后端
$backendJob = Start-Job -ScriptBlock {
    Set-Location $using:PSScriptRoot
    npm run server 2>&1
}

# 等待后端启动
Write-Host "等待后端服务启动..." -ForegroundColor Yellow
Start-Sleep -Seconds 3

# 启动前端
$frontendJob = Start-Job -ScriptBlock {
    Set-Location $using:PSScriptRoot
    npm run client 2>&1
}

# 等待前端启动
Write-Host "等待前端服务启动..." -ForegroundColor Yellow
Start-Sleep -Seconds 5

# 打开浏览器
Write-Host ""
Write-Host "正在打开浏览器..." -ForegroundColor Green
Start-Process "http://localhost:5173"

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  剧本杀排期系统已启动！" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "  前端地址: http://localhost:5173" -ForegroundColor White
Write-Host "  后端地址: http://localhost:3001" -ForegroundColor White
Write-Host ""
Write-Host "  按 Ctrl+C 停止服务" -ForegroundColor Yellow
Write-Host ""

# 显示日志
try {
    while ($true) {
        $backendOutput = Receive-Job -Job $backendJob
        $frontendOutput = Receive-Job -Job $frontendJob
        
        if ($backendOutput) {
            Write-Host "[后端] $backendOutput" -ForegroundColor Blue
        }
        if ($frontendOutput) {
            Write-Host "[前端] $frontendOutput" -ForegroundColor Magenta
        }
        
        Start-Sleep -Milliseconds 100
    }
}
finally {
    # 清理
    Stop-Job -Job $backendJob -ErrorAction SilentlyContinue
    Stop-Job -Job $frontendJob -ErrorAction SilentlyContinue
    Remove-Job -Job $backendJob -ErrorAction SilentlyContinue
    Remove-Job -Job $frontendJob -ErrorAction SilentlyContinue
    Write-Host ""
    Write-Host "服务已停止" -ForegroundColor Red
}
