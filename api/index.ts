// Vercel Serverless 入口
// 直接引用 server/index.ts，所有路由逻辑统一在 server/ 目录下维护
import app from '../server/index';

export default app;
