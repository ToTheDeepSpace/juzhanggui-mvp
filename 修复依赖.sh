#!/bin/bash
set -e

echo "=========================================="
echo "     剧本杀排期系统 - WSL/Linux 依赖修复工具"
echo "=========================================="
echo

echo "[1/3] 停止所有相关进程..."
pkill -f "node.*(vite|nodemon|server)" 2>/dev/null || true
sleep 2
echo "     ✓ 进程已停止"
echo

echo "[2/3] 清理旧依赖..."
if [ -d "node_modules" ]; then
    rm -rf node_modules
    echo "     ✓ 删除 node_modules 文件夹"
else
    echo "     ✓ node_modules 不存在"
fi

if [ -f "package-lock.json" ]; then
    rm -f package-lock.json
    echo "     ✓ 删除 package-lock.json"
else
    echo "     ✓ package-lock.json 不存在"
fi
echo

echo "[3/3] 重新安装依赖（需要网络）..."
echo "     这可能需要几分钟，请耐心等待..."
echo

npm install

if [ $? -eq 0 ]; then
    echo
    echo "     ✓ 依赖安装成功！"
    echo
    echo "请关闭此终端，然后重新运行启动命令"
else
    echo
    echo "     ✗ 依赖安装失败，请检查网络或Node.js版本"
    echo "     建议：检查Node.js版本（需要 >= 18），网络连接"
fi

echo
echo "按任意键退出..."
read -n 1