@echo off
chcp 936 >nul
title 修复剧本杀系统依赖
color 0A

echo ==========================================
echo     剧本杀排期系统 - 依赖修复工具
echo ==========================================
echo.

:: 检查是否以管理员身份运行（可选）
:: net session >nul 2>&1
:: if %errorlevel% neq 0 (
::     echo 警告：建议以管理员身份运行此脚本
::     echo 否则可能无法删除某些文件
::     echo.
::     pause
:: )

echo [1/4] 停止所有相关进程...
taskkill /F /IM node.exe 2>nul >nul
taskkill /F /IM cmd.exe /FI "WINDOWTITLE eq 剧本杀排期系统" 2>nul >nul
timeout /t 2 /nobreak >nul
echo      [OK] 进程已停止
echo.

echo [2/4] 清理旧依赖...
:: 尝试直接安装，如果失败再删除node_modules
echo      尝试修复安装（不删除node_modules）...
npm install --no-audit --no-fund --no-progress
if %errorlevel% equ 0 (
    echo      [OK] 依赖修复成功！
    goto :success
)

echo      修复失败，执行完整清理...
if exist "node_modules" (
    rmdir /s /q node_modules 2>nul
    if exist "node_modules" (
        echo      [FAIL] 无法删除node_modules文件夹
        echo      请关闭所有文件资源管理器窗口，或重启后重试
        pause
        exit /b 1
    )
    echo      [OK] 删除 node_modules 文件夹
) else (
    echo      [OK] node_modules 不存在
)

if exist "package-lock.json" (
    del package-lock.json 2>nul
    echo      [OK] 删除 package-lock.json
) else (
    echo      [OK] package-lock.json 不存在
)

echo.

echo [3/4] 重新安装依赖（需要网络）...
echo      这可能需要几分钟，请耐心等待...
echo.
npm install --no-audit --no-fund --no-progress
if %errorlevel% neq 0 (
    echo.
    echo      [FAIL] 依赖安装失败！
    echo      可能的原因：
    echo      1. 网络连接问题
    echo      2. Node.js版本过低（需要 >= 18）
    echo      3. 权限不足（请以管理员身份运行）
    echo.
    echo      建议操作：
    echo      1. 检查网络连接
    echo      2. 运行「node --version」确认Node.js版本
    echo      3. 右键点击脚本，选择「以管理员身份运行」
    echo.
    pause
    exit /b 1
)

:success
echo.
echo [4/4] 安装平台特定的esbuild...
npm install @esbuild/win32-x64 --no-audit --no-fund --force
npm install @esbuild/linux-x64 --no-audit --no-fund --force 2>nul
echo      [OK] 平台包安装完成

echo.
echo      [OK] 依赖安装成功！
echo.
echo 请关闭此窗口，然后重新运行「启动系统.bat」
echo.

echo 按任意键退出...
pause >nul