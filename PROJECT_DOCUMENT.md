# 剧本杀排期管理系统 — 项目文档

> 面向演绎剧场的一站式排班管理 SaaS 系统
> 技术栈：React + Express + Supabase（PostgreSQL）

---

## 一、项目定位

**目标客户**：演绎剧场（而非普通剧本杀店）

**三个用户角色**：

| 角色 | 核心需求 |
|------|---------|
| 🎭 **DM / 主持人** | 查看自己排班、申请假期、自动统计开本数量、等级成长体系（游戏化） |
| 📞 **客服** | 可视化创建/编辑排班、管理顾客预约 |
| 🎮 **玩家** | 在线查看可预约场次、选择心仪 DM、查看店家推荐剧本 |

**盈利模式**：SaaS 订阅（按月/年收费），目前为单店 MVP，后续扩展多店连锁版。

---

## 二、技术架构总览

```
┌─────────────────────────────────────────────┐
│                 浏览器                          │
│  React + Vite + Tailwind CSS + Capacitor      │
│  (可打包 iOS / Android App)                     │
└──────────────────┬──────────────────────────┘
                   │ HTTP / JSON
                   ▼
┌─────────────────────────────────────────────┐
│           Express API Server                 │
│         （Node.js + TypeScript）               │
│                                              │
│  路由层 → 业务层 → 数据访问层（db/\*.ts）          │
└──────────────────┬──────────────────────────┘
                   │
          ┌────────┴────────┐
          ▼                  ▼
┌─────────────────┐  ┌─────────────────┐
│  Supabase (云端)  │  │  SQLite (本地)   │
│  PostgreSQL      │  │  (仅 evaluations  │
│  主要存储         │  │   在用，逐渐废弃)   │
└─────────────────┘  └─────────────────┘
```

---

## 三、技术栈

### 前端

| 技术 | 用途 |
|------|------|
| React 18 | UI 框架 |
| TypeScript | 类型安全 |
| Vite 5 | 构建工具 + 开发服务器 |
| Tailwind CSS | 样式 |
| React Router 7 | 前端路由 |
| Capacitor 8 | 打包 iOS / Android 原生 App |

### 后端

| 技术 | 用途 |
|------|------|
| Node.js + Express | API 服务器 |
| TypeScript (tsx) | 运行/编译 |
| Nodemon | 开发热重载 |
| JWT (jsonwebtoken) | 认证 |
| Supabase JS SDK | 数据库操作 |
| dotenv | 环境变量加载 |

### 数据库

| 数据库 | 用途 | 状态 |
|--------|------|------|
| **Supabase (PostgreSQL)** | 主要业务数据 | ✅ 生产中 |
| SQLite（本地） | 仅 evaluations 在用 | ⚠️ 需迁移 |

### 部署

| 平台 | 用途 |
|------|------|
| Vercel (Serverless) | API 部署（`api/` 目录） |
| Supabase | 数据库托管 |
| Capacitor | 移动端打包 |

---

## 四、现有功能清单

### 后端 API（14 组路由）

| 模块 | 路由 | 功能 |
|------|------|------|
| 认证 | `/api/auth/*` | 登录、Token 验证 |
| 房间 | `/api/rooms/*` | CRUD 房间管理 |
| 卡司 | `/api/actors/*` | CRUD 卡司，查排班/空闲时段 |
| 剧本 | `/api/scripts/*` | CRUD 剧本 + 角色管理 |
| 排期 | `/api/schedules/*` | CRUD 排期、确认/取消、冲突检测、定时状态流转 |
| 签到 | `/api/checkins/*` | 玩家签到 CRUD + 统计 |
| 顾客 | `/api/customers/*` | 会员 CRUD、搜索、充值/消费 |
| 评价 | `/api/evaluations/*` | 评分 CRUD、按剧本聚合统计 |
| 通知 | `/api/notifications/*` | 站内通知、已读/未读 |
| 偏好 | `/api/preferences/*` | 客户偏好卡司设置 |
| 冲突 | `/api/conflicts/*` | 客户-卡司矛盾记录 |
| 提醒 | `/api/reminders/*` | 定时提醒管理 |
| 批量 | `/api/batch/*` | 批量操作 |
| 管理 | `/api/schedules/admin/*` | 管理端排期操作 |

### 前端页面

| 页面 | 路径 | 说明 |
|------|------|------|
| 登录页 | `/login` | 管理员密码登录 |
| 排期日历 | `/schedule` | 主页面，日历视图查看/创建排期 |
| 房间管理 | `/rooms` | 添加/编辑/删除房间 |
| 卡司管理 | `/actors` | DM 信息管理 |
| 剧本管理 | `/scripts` | 剧本 + 角色管理 |
| 会员管理 | `/customers` | 顾客/会员管理 |
| 矛盾调解 | `/conflicts` | 客户矛盾记录 |
| 签到页面 | `/checkin/:scheduleId` | 玩家扫码签到（公开） |
| 评价页面 | `/evaluate/:scheduleId` | 玩家评价（公开） |

---

## 五、数据库表结构

### 当前 Supabase 中的所有表

| 表名 | 是否有 tenant_id | 说明 |
|------|-----------------|------|
| `tenants` | — (主表) | 店铺/租户表，已有 2 条数据 |
| `user_profiles` | ✅ | 用户角色关联（已有一笔 admin 数据）|
| `rooms` | ✅ | 房间，含 hourly_cost（小时单价）|
| `scripts` | ✅ | 剧本，含 duration_minutes / min_duration_hours / max_duration_hours |
| `actors` | ❌ | 卡司/DM |
| `schedules` | ❌ | 排期 |
| `schedule_actors` | ❌ | 排期-卡司关联 |
| `customers` | ❌ | 顾客/会员 |
| `checkins` | ❌ | 签到记录 |
| `evaluations` | ❌ | 评价 |
| `notifications` | ❌ | 通知 |
| `dm_profiles` | — | DM 扩展信息（等级、薪酬等）|
| `players` | — | 玩家档案 |
| `schedule_players` | — | 排期-玩家关联 |
| 其他业务表 | — | 会员交易、偏好、冲突、提醒等 |

### 核心问题：代码与数据库对不上

| 差异点 | GitHub 代码的期望 | Supabase 数据库实际 |
|--------|-----------------|-------------------|
| scripts 表字段 | `duration`, `min_duration`, `max_duration` | `duration_minutes`, `min_duration_hours`, `max_duration_hours` |
| rooms 表字段 | `name`, `capacity` | 多了 `tenant_id`, `hourly_cost`, `status` |
| 多租户 | 没有 tenant 概念 | 部分表有 `tenant_id`（不完全） |
| evaluations | 用本地 SQLite | 应归入 Supabase |

---

## 六、已知问题和待办

### Bug（已验证）

| 问题 | 状态 | 说明 |
|------|------|------|
| 创建房间失败（缺 tenant_id） | ✅ **已修复** | rooms.ts 未传 tenant_id，数据库拒绝写入 |
| 前端无错误提示 | ✅ **已修复** | RoomManager 现在显示保存失败信息 |

### 待解决问题

| 问题 | 优先级 | 说明 |
|------|--------|------|
| scripts 创建/编辑会失败 | 🔴 高 | 代码用 `duration` 字段，数据库是 `duration_minutes` |
| scripts.getAll 返回字段映射缺失 | 🟡 中 | 前端 Script 类型包含 `duration`, `min_duration`，但数据库列名不同 |
| evaluations 还在用 SQLite | 🟡 中 | 代码中已迁移到 Supabase，但本地 `evaluations.ts` 是死代码 |
| 数据库多租户不完整 | 🟠 低 | actors/schedules/customers 等表没有 tenant_id，后续需加上 |
| Auth 还是单用户密码 | 🟠 低 | 需要接入 Supabase Auth 实现多角色 |
| evaluaions.ts 死代码 | 🟢 低 | `server/db/evaluations.ts` 未被引用，可以删除 |

---

## 七、建议开发路线图

### Phase 1 — MVP 跑通（当前）

- [x] 修复房间创建 bug
- [x] 修复前端错误提示
- [ ] 修复 scripts 创建/编辑（列名映射）
- [ ] 统一 evaluations 到 Supabase

### Phase 2 — 多角色认证

- [ ] 接入 Supabase Auth（邮箱/手机登录）
- [ ] 区分管理员、客服、DM、玩家四种角色
- [ ] 完成所有表的 tenant_id 隔离

### Phase 3 — DM 体验（竞争力）

- [ ] DM 专属主页：只看自己的排班
- [ ] 自动统计：本月开本数、总场次、评分
- [ ] DM 等级体系（根据场次 + 评分升级）
- [ ] 请假/换班申请流程

### Phase 4 — 玩家端

- [ ] 玩家查看可预约场次
- [ ] 玩家选择 DM + 预订
- [ ] 店家推荐剧本展示

### Phase 5 — 商业化

- [ ] SaaS 后台：管理店铺、查看用量
- [ ] 多店连锁版
- [ ] AI 客服辅助排班（OpenClaw 集成）
- [ ] 飞书/企微通知集成

---

## 八、项目文件结构

```
script-scheduler/
├── client/                    # 前端 React 应用
│   ├── src/
│   │   ├── components/        # UI 组件
│   │   ├── contexts/          # React Context（Auth）
│   │   ├── hooks/             # 自定义 Hooks（useApi, useScheduleCheckins）
│   │   ├── pages/             # 页面组件
│   │   ├── types/             # TypeScript 类型定义
│   │   ├── App.tsx            # 路由配置
│   │   ├── main.tsx           # 入口
│   │   └── config.ts          # 环境配置
│   └── index.html
├── server/                    # 后端 Express 应用
│   ├── db/                    # 数据访问层
│   ├── lib/                   # 工具库（supabase 客户端）
│   ├── middleware/            # 中间件（JWT 认证）
│   ├── routes/                # API 路由
│   └── index.ts               # 入口
├── scripts/                   # 开发脚本
├── api/                       # Vercel Serverless 部署
├── .env                       # 环境变量（本地配置）
├── vercel.json                # Vercel 部署配置
├── supabase-schema.sql        # Supabase 建表 SQL（旧版）
├── start.ps1                  # PowerShell 启动脚本
└── 启动.bat                   # Windows 启动脚本
```

---

## 九、本地开发指南

### 启动

```bash
cd script-scheduler
npm install
npm run dev        # 同时启动后端(:3001) + 前端(:5173)
```

### 关键环境变量 (.env)

| 变量 | 说明 |
|------|------|
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase 服务端密钥 |
| `DEFAULT_TENANT_ID` | 默认店铺 ID |
| `JWT_SECRET` | JWT 签名密钥 |
| `VITE_CHECKIN_BASE_URL` | 签到页面的基础 URL |

### 当前登录

- 密码：`admin123`（可在 `.env` 重设）

---

> 文档版本：v0.1 | 最后更新：2026-05-04
