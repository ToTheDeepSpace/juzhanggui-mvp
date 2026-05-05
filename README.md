# 剧掌柜 · 沉浸式娱乐操作系统

> **版本**：v0.5.0  
> **状态**：生产部署中  
> **线上地址**：https://script-scheduler.vercel.app  
> **灵契（创作者端）**：https://lingqi.vercel.app  

面向演绎剧场/密室/沉浸式戏剧的一站式运营系统。排期管理、抢车模式、玩家签到、卡司管理、数据看板。

---

## 核心功能

### 🚗 排期管理
- **完整生命周期**：待锁车 → 已锁车(定金确认) → 已排班(角色分配) → 开本中 → 结束登记
- **抢车模式**：玩家自助扫码上车，满员自动确认
- **冲突检测**：选房间/卡司时自动高亮冲突时段
- **车次编号**：每车自动分配 #001, #002... 方便客服对账
- **已结束标签**：已完成/炸车/流车/其他问题 分类查看

### 📱 玩家签到
- **扫码上车**：二维码签到，手机验证码登录后自动注册
- **角色选择**：显示角色名+性别，已选角色自动隐藏
- **性别标注**：玩家选性别，默认异性恋配对说明
- **客服代填**：客服可在一个页面连续添加多位玩家

### 🎭 卡司管理
- **卡司资料**：姓名、电话、技能绑定
- **灵契打通**：自动匹配灵契创作者主页，一键跳转
- **冲突检测**：选卡司时自动检测时段冲突

### ✅ 结束登记
- **四种结果**：正常结束 / 炸车(中途取消) / 流车(未开取消) / 其他问题
- **评价二维码**：登记时自动生成评价码，玩家扫码评价
- **矛盾登记**：内嵌矛盾录入，自动同步到矛盾调解页
- **打扫确认**：房间打扫、道具归集、衣物整理三选确认

### 🔗 灵契打通
- 剧掌柜的卡司自动匹配灵契的个人主页
- 支持跳转查看/邀请入驻
- 同一套 Supabase 底层数据

---

## 排班生命周期

```
创建排班（待锁车）
    ↓ 橙色「锁车」—— 确认定金已收
已锁车（已锁车）
    ↓ 紫色「确认排班」—— 分配角色和卡司
已排班（已排班）
    ↓ 蓝色「确认开始」—— 选卡司+填实际开本时间
开本中（进行中）
    ↓ 绿色「结束登记」
           ├ ✅ 正常结束
           ├ 💥 炸车（含矛盾登记）
           ├ 🚫 流车
           └ ❓ 其他问题
```

## 技术栈

| 层 | 技术 |
|----|------|
| 前端 | React 18 + TypeScript + Vite 5 |
| 样式 | Tailwind CSS 3 |
| 后端 | Express 4 (Node.js) |
| 数据库 | Supabase (PostgreSQL) |
| 部署 | Vercel (前端+API) |
| 二维码 | qrcode.react |
| 日期 | date-fns |

## 项目结构

```
script-scheduler/
├── client/src/
│   ├── components/         # 管理后台组件
│   │   ├── ScheduleCalendar.tsx      # 排班核心（抢车模式+结束登记）
│   │   ├── ScheduleCalendarModal.tsx # 排班创建/编辑
│   │   ├── ActorManager.tsx          # 卡司管理（含灵契打通）
│   │   ├── RoomManager.tsx           # 房间管理
│   │   ├── ScriptManager.tsx         # 剧本管理
│   │   ├── CustomerManager.tsx       # 会员管理
│   │   ├── QRCodeModal.tsx           # 签到二维码
│   │   ├── CheckInRoles.tsx          # 签到角色展示
│   │   └── ConfirmScheduleModal.tsx   # 确认排期
│   ├── pages/
│   │   ├── CheckInPage.tsx           # 玩家扫码签到（含验证码登录）
│   │   ├── EvaluationPage.tsx        # 玩家评价
│   │   ├── LoginPage.tsx             # 管理登录
│   │   └── ConflictResolutionPage.tsx  # 矛盾调解
│   ├── hooks/
│   │   ├── useApi.ts
│   │   └── useScheduleCheckins.ts
│   └── types/
├── api/index.ts            # Vercel Serverless API（自包含）
├── server/index.ts         # 本地开发服务器
└── .env                    # 环境配置
```

## API 概览

| 端点 | 说明 |
|------|------|
| `POST /api/auth/login` | 管理员登录 |
| `GET/POST/PUT/DELETE /api/rooms` | 房间 CRUD |
| `GET/POST/PUT/DELETE /api/actors` | 卡司 CRUD（含灵契主页匹配） |
| `GET/POST/PUT/DELETE /api/scripts` | 剧本 CRUD |
| `GET/POST/PUT/DELETE /api/schedules` | 排期 CRUD（含抢车模式） |
| `PUT /api/schedules/:id/confirm` | 确认排期 |
| `PUT /api/schedules/:id/cancel` | 取消/流车 |
| `PUT /api/schedules/:id/complete` | 完成排期 |
| `POST /api/schedules/:id/dm-start` | 卡司端确认开始 |
| `GET /api/schedules/conflicts/check` | 冲突检测 |
| `GET /api/schedules/:id/public` | 签到页公开信息 |
| `POST /api/schedules/:id/checkin` | 玩家签到（含满员检测）|
| `POST /api/player/send-code` | 发送验证码 |
| `POST /api/player/verify-code` | 验证码登录/注册 |
| `POST /api/conflicts` | 创建矛盾记录 |
| `GET/POST/DELETE /api/lc/...` | 灵契创作者 API |

## 本地开发

```bash
npm install
npm run dev
# 前端 :5173 | 后端 :3001
```

## 部署

项目部署在 Vercel，自动从 GitHub 构建部署。
环境变量（Vercel 后台设置）：

```
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
JWT_SECRET=
DEFAULT_TENANT_ID=
```

---

*文档版本 v0.5.0 | 2026-05-06*
