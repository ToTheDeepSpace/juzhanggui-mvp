import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.scriptsaas.scheduler',
  appName: '剧本杀排期',
  webDir: 'dist/client',

  // 开发服务器
  server: {
    // 本地开发时，让 App 加载 Vite 开发服务器
    // 上线前注释掉这行
    // url: 'http://192.168.1.x:5173',
    cleartext: true,   // 允许 HTTP（本地开发需要）
  },

  // Android 平台
  android: {
    allowMixedContent: true,        // 允许混合内容
    backgroundColor: '#0f172a',     // 启动屏背景色 (slate-900)
  },

  // iOS 平台
  ios: {
    backgroundColor: '#0f172a',
  },

  // 插件配置
  plugins: {
    // 状态栏
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#0f172a',
    },
  },
};

export default config;
