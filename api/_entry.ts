// esbuild 入口 — 被 esbuild 编译为 api/index.js
// _ 前缀让 Vercel 忽略此文件（不会创建独立 serverless function）
import app from './lib/app';
export default app;
