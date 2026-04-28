@echo off
chcp 936 >nul
title 剧本杀排期系统
color 0A

:: ===================================================
::  剧本杀排期管理系统 — 启动脚本
::  双击即可运行，自动处理所有环境问题
:: ===================================================

:: ----- 1. 跳到脚本所在目录 -----
cd /d "%~dp0"

:: ----- 2. 修复 Node.js PATH -----
if exist "C:\Program Files\nodejs\node.exe" (
    set "PATH=C:\Program Files\nodejs;%PATH%"
) else if exist "C:\Program Files (x86)\nodejs\node.exe" (
    set "PATH=C:\Program Files (x86)\nodejs;%PATH%"
) else if exist "%LOCALAPPDATA%\Programs\node\node.exe" (
    set "PATH=%LOCALAPPDATA%\Programs\node;%PATH%"
)

echo ========================================
echo     剧本杀排期管理系统
echo ========================================
echo.

:: ----- 3. 检查 Node.js -----
echo [检查] Node.js 环境...
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo   [FAIL] 找不到 Node.js
    echo   请安装 Node.js 18+: https://nodejs.org/
    pause
    exit /b 1
)
for /f "tokens=*" %%i in ('node --version') do set "NV=%%i"
echo   [OK]  Node.js %NV%

:: ----- 4. 检查 npm -----
npm --version >nul 2>&1
if %errorlevel% neq 0 (
    echo   [FAIL] npm 不可用
    pause
    exit /b 1
)
for /f "tokens=*" %%i in ('npm --version') do set "NPV=%%i"
echo   [OK]  npm %NPV%
echo.

:: ----- 5. 检查/安装依赖 -----
echo [检查] 项目依赖...
if not exist "node_modules\" (
    echo   正在安装依赖（首次运行约 1-3 分钟）...
    call npm install --no-progress
    if %errorlevel% neq 0 (
        echo   [FAIL] 依赖安装失败
        pause
        exit /b 1
    )
    echo   [OK]  依赖安装完成
) else (
    echo   [OK]  依赖已存在
    :: 检查 esbuild 平台是否匹配
    if not exist "node_modules\vite\node_modules\@esbuild\win32-x64\esbuild.exe" (
        if exist "node_modules\vite\node_modules\@esbuild\linux-x64\bin\esbuild" (
            echo   [WARN] 检测到 Linux 版 esbuild，需重装
            rmdir /s /q node_modules 2>nul
            del package-lock.json 2>nul
            echo   正在重新安装...
            call npm install --no-progress
            if errorlevel 1 (
                echo   [FAIL] 重装失败
                pause
                exit /b 1
            )
            echo   [OK]  重装完成
        )
    )
)
echo.

:: ----- 6. 确保 data 目录存在 -----
if not exist "data\" mkdir data

:: ----- 7. 清理旧进程 -----
echo [清理] 停止残留 node 进程...
taskkill /F /IM node.exe >nul 2>&1
timeout /t 1 /nobreak >nul
echo   [OK]  清理完成
echo.

:: ----- 8. 启动 -----
echo ========================================
echo   前端 : http://localhost:5173
echo   后端 : http://localhost:3001
echo   按 Ctrl+C 停止所有服务
echo ========================================
echo.

call npm run dev

echo.
echo 系统已停止。
pause
