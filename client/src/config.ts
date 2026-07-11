/// <reference types="vite/client" />

// 环境配置
// 前端通过 Vite 的 import.meta.env 读取环境变量
// 开发环境：留空，生产环境填入实际域名

/**
 * 签到页面的基础 URL（用于生成二维码）
 * 优先级：环境变量 > window.location.origin（开发默认）
 */
export const CHECKIN_BASE_URL =
  import.meta.env.VITE_CHECKIN_BASE_URL || window.location.origin;

const configuredJumuluSiteUrl =
  import.meta.env.VITE_JUMULU_SITE_URL ||
  import.meta.env.VITE_LINGQI_SITE_URL ||
  'https://jumulu.jusichen.com';

// Keep the legacy env key compatible while sending users directly to the renamed site.
export const JUMULU_SITE_URL = configuredJumuluSiteUrl
  .replace(/^https:\/\/lingqi\.jusichen\.com(?=\/|$)/, 'https://jumulu.jusichen.com')
  .replace(/\/$/, '');
