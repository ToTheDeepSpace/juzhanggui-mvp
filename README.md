# 剧本杀排期系统 · script-scheduler

> 面向剧本杀门店的一站式排期管理工具，覆盖从剧本/卡司/房间配置到排期创建、玩家签到、评价收集、会员管理的完整业务流程。

---

## 目录

- [功能概览](#功能概览)
- [技术栈](#技术栈)
- [项目结构](#项目结构)
- [数据库设计](#数据库设计)
- [API 接口文档](#api-接口文档)
- [前端页面与组件](#前端页面与组件)
- [环境配置](#环境配置)
- [本地开发启动](#本地开发启动)
- [构建与部署](#构建与部署)
- [已知问题 & 待办](#已知问题--待办)

---

## 功能概览

| 模块 | 功能描述 |
|------|---------|
| **排期管理** | 日历视图查看/创建排期，支持「待排期」→「已确认」→「进行中」→「已完成」状态流转，房间/卡司冲突检测，批量操作 |
| **房间管理** | 添加/编辑/删除房间，支持设置容量，批量删除 |
| **卡司管理** | 添加/编辑/删除卡司，绑定技能（擅长剧本+角色+熟练度），查看当日可用状态 |
| **剧本管理** | 添加/编辑/删除剧本，配置玩家角色、卡司角色、时长范围（最短/最长），支持性别限制 |
| **玩家签到** | 二维码签到页（公开访问），角色选择，防止重复抢注，自动同步客户信息 |
| **评价系统** | 扫码评价页（1-5星 + 评论），支持按剧本汇总评分统计 |
| **会员管理** | 客户档案，会员等级（无/铜/银/金），余额/充值/消费/退款流水，卡司偏好记录 |
| **矛盾调解** | 记录客户与卡司的矛盾事件，跟踪处理进度（待处理/已解决/已升级） |
| **提醒系统** | 排期开始/结束/付款提醒，状态跟踪（待发/已发/失败） |

---

## 技术栈

| 层 | 技术 | 版本 |
|----|------|------|
| 前端框架 | React | 18.2 |
| 前端路由 | React Router DOM | 7.x |
| 构建工具 | Vite | 5.x |
| UI 样式 | Tailwind CSS | 3.x（主色调：primary sky-blue） |
| 语言 | TypeScript | 5.x（全栈） |
| 后端框架 | Express | 4.18 |
| 数据库 | SQLite（via `sqlite` + `sqlite3`） | - |
| 后端运行时 | tsx（开发热重载） / Node.js（生产） | - |
| 工具库 | date-fns（日期）, uuid（主键）, qrcode.react（二维码） | - |

**架构模式**：Monorepo-light 单仓库，`client/`（前端）+ `server/`（后端）+ `data/`（SQLite 文件）共存。Vite 开发服务器通过 proxy 将 `/api` 请求转发到 Express（端口 3001）。

---

## 项目结构

```
script-scheduler/
├── client/                        # 前端（Vite + React + TS）
│   ├── index.html
│   └── src/
│       ├── App.tsx                # 路由入口
│       ├── main.tsx
│       ├── config.ts              # 环境配置（签到 URL 等）
│       ├── components/            # 业务组件（管理后台）
│       │   ├── MainLayout.tsx     # 后台主布局 + Tab 导航
│       │   ├── ScheduleCalendar.tsx         # 排期日历（核心）
│       │   ├── ScheduleCalendarModal.tsx    # 排期创建/编辑 Modal
│       │   ├── ScriptManager.tsx            # 剧本管理
│       │   ├── ActorManager.tsx             # 卡司管理
│       │   ├── CustomerManager.tsx          # 会员管理
│       │   ├── RoomManager.tsx              # 房间管理
│       │   ├── CheckInRoles.tsx             # 签到角色展示
│       │   ├── ConfirmScheduleModal.tsx     # 确认排期 Modal
│       │   ├── GuestRegistration.tsx        # 客人登记表单
│       │   ├── PendingScheduleCard.tsx      # 待排期卡片
│       │   ├── QRCodeModal.tsx              # 签到二维码 Modal
│       │   └── StaffCheckInPage.tsx         # 工作人员手动签到
│       ├── pages/                 # 独立公开页面
│       │   ├── CheckInPage.tsx              # 玩家扫码签到（公开）
│       │   ├── EvaluationPage.tsx           # 玩家评价（公开）
│       │   └── ConflictResolutionPage.tsx   # 矛盾调解
│       ├── hooks/
│       │   ├── useApi.ts          # 通用 HTTP Hook（含请求去重）
│       │   └── useScheduleCheckins.ts
│       └── types/
│           ├── index.ts           # 核心类型定义
│           └── schedule.ts        # 排期扩展类型
│
├── server/                        # 后端（Express + SQLite）
│   ├── index.ts                   # Express 入口 + 全部 API 路由（约 1055 行）
│   └── db.ts                      # 数据库初始化 + 所有 DB 操作类（约 1059 行）
│
├── data/                          # 数据库文件（运行时生成）
│   └── scheduler.db
│
├── scripts/                       # 工具脚本
│   ├── dev.js                     # 并发启动前后端
│   ├── add-role-column.js         # 迁移：添加角色列
│   ├── check-db.mjs               # 数据库结构检查
│   └── migrate-pending-schedule.mjs
│
├── dist/                          # 构建产物
├── package.json
├── tsconfig.json                  # 前端 TS 配置
├── tsconfig.node.json             # 后端 TS 配置
├── vite.config.ts
├── tailwind.config.js
├── .env / .env.example
├── CODE_REVIEW.md                 # 代码审查记录
├── CODING_STANDARD.md             # 编码规范
├── start.ps1                      # PowerShell 启动脚本
└── 启动.bat                        # Windows 批处理启动
```

---

## 数据库设计

数据库文件路径：`data/scheduler.db`（相对于项目根目录）

### 核心数据表

```
rooms                   房间
actors                  卡司（DM / 主持 / 其他角色扮演者）
scripts                 剧本
script_player_roles     剧本玩家角色定义
script_actor_roles      剧本卡司角色定义
script_roles            卡司角色时间配置（含进场偏移量）
actor_skills            卡司技能（会哪些剧本的哪些角色，含熟练度）
schedules               排期
schedule_actors         排期内卡司分配
checkins                玩家签到记录
evaluations             排期评价
customers               客户 / 会员
membership_transactions 会员充值 / 消费流水
customer_preferences    客户偏好卡司
conflict_records        客户与卡司矛盾记录
reminders               排期提醒
```

### 排期状态流转

```
pending（待确认）→ scheduled（已确认）→ ongoing（进行中）→ completed（已完成）
         ↓                  ↓                   ↓
     cancelled          cancelled           cancelled
```

- `pending`：已登记，尚未分配房间
- `scheduled`：已确认房间和时间，等待开始
- `ongoing`：定时任务每分钟检查，到开始时间自动切换
- `completed` / `cancelled`：终态

### 关键字段说明

| 表 | 字段 | 说明 |
|----|------|------|
| `scripts` | `min_duration` / `max_duration` | 剧本时长范围（分钟）；旧字段 `duration` 等于 `min_duration` 以兼容 |
| `schedules` | `room_id` | 允许为空（`pending` 状态下未分配房间） |
| `customers` | `balance` | 单位：**分**（整数存储，避免浮点问题） |
| `evaluations` | `(schedule_id, guest_name)` | UNIQUE 约束，防止同一玩家重复评价 |
| `actor_skills` | `(actor_id, script_id, role_name)` | UNIQUE 约束 |

### 自动迁移

服务启动时执行 `runMigrations()`（幂等），自动检测并补全：
- `evaluations.guest_name`
- `scripts.min_duration` / `scripts.max_duration`
- `script_player_roles.gender` / `script_actor_roles.gender` / `script_roles.gender`
- `evaluations` 表重建，添加 `UNIQUE(schedule_id, guest_name)` 约束

---

## API 接口文档

所有接口统一返回格式：

```json
{ "success": true, "data": ... }
// 或
{ "success": false, "error": "错误描述" }
```

### 房间 `/api/rooms`

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/rooms` | 获取所有房间 |
| POST | `/api/rooms` | 创建房间 `{ name, capacity? }` |
| PUT | `/api/rooms/:id` | 更新房间 `{ name, capacity? }` |
| DELETE | `/api/rooms/:id` | 删除房间 |
| POST | `/api/rooms/batch-delete` | 批量删除 `{ ids: string[] }` |
| GET | `/api/rooms/:id/schedules` | 获取房间排期（需传 `?startDate=&endDate=`） |

### 卡司 `/api/actors`

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/actors` | 获取所有卡司 |
| POST | `/api/actors` | 创建卡司 `{ name, phone? }` |
| PUT | `/api/actors/:id` | 更新卡司 |
| DELETE | `/api/actors/:id` | 删除卡司 |
| POST | `/api/actors/batch-delete` | 批量删除 |
| GET | `/api/actors/:id/skills` | 获取卡司技能列表 |
| POST | `/api/actors/:id/skills` | 添加技能 `{ scriptId, roleName, roleType, proficiency }` |
| DELETE | `/api/actors/:actorId/skills/:scriptId/:roleName` | 删除技能 |
| GET | `/api/actors/:id/availability?date=YYYY-MM-DD` | 查询某日空闲时段 |
| GET | `/api/actors/:id/schedules?startDate=&endDate=` | 获取卡司排期 |

### 剧本 `/api/scripts`

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/scripts` | 获取所有剧本（含角色数量统计） |
| GET | `/api/scripts/:id` | 获取剧本详情（含角色 + 技能卡司） |
| POST | `/api/scripts` | 创建剧本 `{ name, minDuration, maxDuration, playerRoles, actorRoles }` |
| PUT | `/api/scripts/:id` | 更新剧本 |
| DELETE | `/api/scripts/:id` | 删除剧本 |
| POST | `/api/scripts/batch-delete` | 批量删除 |
| POST | `/api/scripts/:id/roles` | 添加卡司角色配置 `{ roleName, requiredDuration?, startOffset? }` |
| DELETE | `/api/scripts/:scriptId/roles/:roleId` | 删除角色配置 |
| GET | `/api/scripts/:id/evaluations` | 获取剧本所有评价 |
| GET | `/api/scripts/:id/evaluation-stats` | 获取剧本评分统计 |

### 排期 `/api/schedules`

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/schedules?startDate=&endDate=` | 获取排期列表 |
| GET | `/api/schedules/:id` | 获取排期详情（含卡司） |
| POST | `/api/schedules` | 创建排期（含冲突检测） |
| PUT | `/api/schedules/:id` | 更新排期 |
| DELETE | `/api/schedules/:id` | 删除排期 |
| PUT | `/api/schedules/:id/confirm` | 确认排期（分配房间，`pending`→`scheduled`）`{ roomId }` |
| PUT | `/api/schedules/:id/cancel` | 取消排期 |
| POST | `/api/schedules/cleanup` | 手动清理过期 pending 排期 |
| GET | `/api/schedules/:id/public` | 获取公开信息（签到二维码用） |
| POST | `/api/schedules/:id/checkin` | 玩家签到 `{ name, phone?, role, avatar? }` |
| GET | `/api/schedules/:id/checkins` | 获取签到列表（管理后台） |
| POST | `/api/schedules/:scheduleId/checkins/kick` | 踢出签到 `{ guestName, role }` |
| GET | `/api/schedules/:id/evaluation` | 获取排期评价 |
| POST | `/api/schedules/:id/evaluate` | 提交评价 `{ guestName, rating(1-5), comment? }` |
| GET | `/api/schedules/:id/conflicts` | 获取排期矛盾记录 |
| GET | `/api/schedules/:id/reminders` | 获取排期提醒 |

**创建/更新排期 Body 参数：**
```json
{
  "scriptId": "uuid",
  "roomId": "uuid",           // 可空（pending 状态）
  "startTime": "ISO8601",
  "endTime": "ISO8601",
  "customerName": "string",
  "customerPhone": "string",
  "playerCount": 6,
  "note": "string",
  "status": "pending|scheduled",
  "actors": [
    {
      "actorId": "uuid",
      "roleName": "string",
      "startTime": "ISO8601",
      "endTime": "ISO8601"
    }
  ]
}
```

### 签到 `/api/checkins`

| 方法 | 路径 | 说明 |
|------|------|------|
| DELETE | `/api/checkins/:id` | 删除签到记录（管理员操作） |

### 会员 `/api/customers`

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/customers` | 获取所有客户 |
| GET | `/api/customers/search?q=` | 模糊搜索客户 |
| GET | `/api/customers/:id` | 获取客户详情（含交易记录） |
| POST | `/api/customers` | 创建客户 `{ name, phone?, membershipLevel?, balance? }` |
| PUT | `/api/customers/:id` | 更新客户 |
| DELETE | `/api/customers/:id` | 删除客户 |
| POST | `/api/customers/:id/transactions` | 充值/消费 `{ amount, transactionType, note?, scheduleId? }` |
| GET | `/api/customers/:id/preferences` | 获取偏好卡司 |
| POST | `/api/customers/:id/preferences` | 添加偏好 `{ actorId, preferenceLevel?, notes? }` |
| PUT | `/api/customers/preferences/:preferenceId` | 更新偏好 |
| DELETE | `/api/customers/preferences/:preferenceId` | 删除偏好 |
| GET | `/api/customers/:id/conflicts` | 获取客户矛盾记录 |

`transactionType` 枚举：`recharge`（充值）/ `consume`（消费）/ `refund`（退款）

### 矛盾记录 `/api/conflicts`

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/conflicts/pending` | 获取所有未解决矛盾 |
| POST | `/api/conflicts` | 创建矛盾记录 |
| PUT | `/api/conflicts/:id` | 更新矛盾记录（含解决方案） |
| DELETE | `/api/conflicts/:id` | 删除矛盾记录 |

`conflictType` 枚举：`service_attitude` / `performance` / `communication` / `other`  
`status` 枚举：`pending` / `resolved` / `escalated`

### 提醒 `/api/reminders`

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/reminders/pending` | 获取待发送提醒 |
| POST | `/api/reminders` | 创建提醒 `{ scheduleId, reminderType, triggerTime }` |
| PUT | `/api/reminders/:id/sent` | 标记已发送 |

`reminderType` 枚举：`start` / `end` / `payment`

### 系统

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/health` | 健康检查 |

---

## 前端页面与组件

### 路由结构

```
/checkin/:scheduleId    → CheckInPage         玩家扫码签到（无需登录，公开访问）
/evaluate/:scheduleId  → EvaluationPage       玩家评价提交（公开访问）
/*                     → MainLayout（管理后台）
  /schedule            → ScheduleCalendar     排期日历（默认首页）
  /rooms               → RoomManager          房间管理
  /actors              → ActorManager         卡司管理
  /scripts             → ScriptManager        剧本管理
  /customers           → CustomerManager      会员管理
  /conflicts           → ConflictResolutionPage  矛盾调解
```

### 核心组件说明

**ScheduleCalendar.tsx**（排期日历，14.9 KB）  
系统核心视图，月/周日历展示排期，支持创建、编辑、状态切换。

**ScriptManager.tsx**（剧本管理，21.3 KB）  
剧本 CRUD，配置玩家角色/卡司角色，支持角色性别设置，双时长（最短/最长）。

**CustomerManager.tsx**（会员管理，26 KB）  
最重的组件，包含客户档案、会员等级设置、充值/消费/退款操作、偏好卡司管理。

**ActorManager.tsx**（卡司管理，13.8 KB）  
卡司 CRUD，技能绑定（剧本+角色+熟练度），查看排期。

**CheckInPage.tsx**（玩家签到，10.5 KB，公开页）  
扫码后展示剧本/时间/可选角色，填写姓名/手机/头像后完成签到。

### 通用 Hook

**useApi.ts**  
封装 GET / POST / PUT / DELETE，带请求去重（基于 AbortController），统一 loading/error 状态。

```typescript
const { get, post, put, del, loading, error } = useApi();
const result = await get<Room[]>('/rooms');
```

---

## 环境配置

复制 `.env.example` 为 `.env`，按需填写：

```env
# 签到二维码基础 URL
# 开发环境留空（自动用 window.location.origin）
# 生产环境填入域名：https://your-domain.com
VITE_CHECKIN_BASE_URL=

# API 路径前缀（一般不需要改）
VITE_API_PREFIX=/api
```

---

## 本地开发启动

**要求**：Node.js 18+

```bash
# 安装依赖
npm install

# 启动（前后端同时启动）
npm run dev

# 或使用批处理文件（Windows）
启动.bat
```

启动后：
- 前端：http://localhost:5173
- 后端：http://localhost:3001
- 数据库：`data/scheduler.db`（自动创建）

单独启动：
```bash
npm run server   # 仅后端（nodemon 热重载）
npm run client   # 仅前端（Vite）
```

---

## 构建与部署

```bash
npm run build
# 构建产物输出到 dist/client/
```

生产部署时，Express 后端可直接 serve `dist/client/` 静态文件，避免跨域问题：

```typescript
// server/index.ts（生产模式可添加）
app.use(express.static(path.join(__dirname, '../dist/client')));
```

---

## 已知问题 & 待办

### 已知问题

- [ ] `server/index.ts` 单文件超 1000 行，建议按业务模块拆分路由（`routes/rooms.ts` 等）
- [ ] `server/db.ts` 单文件超 1000 行，建议按表拆分 DB 操作类
- [ ] 根目录存在遗留 `scheduler.db`，正式数据库在 `data/scheduler.db`，可清理根目录旧文件
- [ ] 评价 API 同时存在 `getBySchedule` 和 `upsert`，按排期只能查到一条评价，实际表支持多条（UNIQUE on `schedule_id + guest_name`）——前端展示逻辑需确认
- [ ] 提醒功能（`reminders` 表）接口已实现，但目前未接入实际推送渠道（短信/微信等）

### 近期待办

- [ ] 后端路由按模块拆分
- [ ] 添加登录鉴权（管理后台目前无任何认证）
- [ ] 排期日历支持周视图拖拽
- [ ] 统计报表页面（每日/每月营收、剧本上座率、卡司工时）
- [ ] 提醒推送对接（短信或企业微信）

---

## 开发规范

见 [CODING_STANDARD.md](./CODING_STANDARD.md)  
代码审查记录见 [CODE_REVIEW.md](./CODE_REVIEW.md)

---

_文档生成于 2026-04-26，基于当前代码库自动整理_
