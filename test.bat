@echo off
chcp 936 >nul
echo ==========================================
echo     测试脚本 - 检查编码
echo ==========================================
echo.
echo [测试1] 输出中文：剧本杀排期系统
echo [测试2] 当前目录：%cd%
echo [测试3] Node.js版本：
node --version
echo.
echo [测试4] 检查npm命令：
npm --version
echo.
echo [测试5] 列出当前目录：
dir /b
echo.
echo ==========================================
echo     测试完成，按任意键退出...
echo ==========================================
pause >nul