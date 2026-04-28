#!/usr/bin/env node
/**
 * 开发环境启动脚本
 * 同时启动后端和前端服务
 */

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = dirname(__dirname);

console.log('🚀 启动剧本杀排期管理系统...\n');

// 启动后端服务
console.log('📦 启动后端服务 (端口: 3001)...');
const server = spawn('npm', ['run', 'server'], {
  cwd: rootDir,
  stdio: 'inherit',
  shell: true
});

// 等待2秒后启动前端
setTimeout(() => {
  console.log('\n🎨 启动前端服务 (端口: 5173)...');
  const client = spawn('npm', ['run', 'client'], {
    cwd: rootDir,
    stdio: 'inherit',
    shell: true
  });

  // 前端关闭时同时关闭后端
  client.on('close', (code) => {
    console.log(`\n前端服务已关闭 (退出码: ${code})`);
    server.kill();
    process.exit(code);
  });
}, 2000);

// 捕获Ctrl+C
process.on('SIGINT', () => {
  console.log('\n\n👋 正在关闭服务...');
  server.kill();
  process.exit(0);
});

// 后端错误处理
server.on('error', (err) => {
  console.error('后端服务启动失败:', err.message);
  process.exit(1);
});
