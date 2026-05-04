// Vercel 入口（会被 esbuild 打包成单文件）
// 这个文件引用 server/ 下的模块，esbuild 会全部内联打包
import app from './_app';
export default app;
