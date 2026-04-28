# script-scheduler 代码审查报告

> 审查时间：2026-04-18
> 审查范围：`D:\泡泡老师-工作空间\script-scheduler`
> 技术栈：Express + SQLite（后端） + React + TypeScript + Tailwind（前端）
> 代码规模：后端 ~33KB，后端组件 ~56KB

---

## 🔴 P0 — 必须立即修复（阻塞性问题）

### 1. TS/CJS 双重源文件 — 系统分裂
**文件：** `server/index.ts` + `server/index.cjs`，`server/db.ts` + `server/db.cjs`

问题：项目同时维护两套源码（TypeScript 和 CommonJS），谁在跑、哪个是最新、编译流程是什么——完全不清楚。这会导致：
- 改一个文件，忘了改另一个
- Bug 在 .ts 里修了，.cjs 里的旧 Bug 还在
- 部署时不知道该跑哪个

**建议：** 立即删除 `.cjs` 文件，统一用 TypeScript + `tsx` 运行，后续编译交给构建工具（Vitest/TSup）。

---

### 2. ScheduleCalendar.tsx 是"上帝组件" — 35KB 单文件
**文件：** `client/src/components/ScheduleCalendar.tsx`（859行）

问题：单个组件承担了：日历渲染、弹窗管理、表单状态、QR弹窗、确认排期弹窗、签到轮询、二维码轮询、角色点击踢人——超过15种职责。

后果：改任何一个逻辑都可能破坏其他功能；无法单独测试任何子功能；新功能只能继续往里堆。

**建议：** 拆分为：
```
components/
  ScheduleCalendar/        ← 主容器
    WeeklyGrid.tsx         ← 日历表格
    PendingList.tsx        ← 待排期列表
    ScheduleModal.tsx       ← 新建/编辑弹窗
    QRModal.tsx            ← 二维码弹窗
    ConfirmModal.tsx        ← 确认排期弹窗
    CheckInRoles.tsx        ← 签到角色显示
hooks/
  useSchedulePolling.ts    ← 签到轮询逻辑
```

---

### 3. 二维码 URL 硬编码内网 IP
**文件：** `ScheduleCalendar.tsx` 第792行
```tsx
value={`http://192.168.1.12:5173/checkin/${qrSchedule.id}`}
```

问题：本地 IP 地址写死，换网络/换机器/部署到服务器就全挂。

**建议：** 改为 `window.location.origin`，或通过环境变量注入：
```tsx
const API_BASE = import.meta.env.VITE_API_BASE_URL || window.location.origin;
value={`${API_BASE}/checkin/${qrSchedule.id}`}
```

---

## 🟠 P1 — 重要问题（影响稳定性和可维护性）

### 4. `useApi.ts` 状态与实际行为不符
**文件：** `client/src/hooks/useApi.ts`

问题：
- `loading` 状态在每个 hook 实例里独立管理，但同一个接口被多个组件调用，各有各的 `loading`
- 同一个 API 请求可以被重复触发（用户快速点两次"保存"会发两个请求）
- `error` 状态声明了但从未被组件使用

**建议：** 引入请求取消或防抖：
```tsx
// 基础版本：加 abort signal
// 推荐版本：用 TanStack Query（@tanstack/react-query）统一管理全局 loading/error/cache
```

---

### 5. 重复轮询 — 浪费资源
**文件：** `ScheduleCalendar.tsx`

问题：
- `CheckInRoles` 组件内部每 3 秒轮询一次签到列表（第27行）
- `QRModal` 弹窗里又每 3 秒轮询一次（第387行）
- 打开编辑弹窗 + 二维码弹窗时，签到接口被轮询 2 份

**建议：** 签到状态统一在父组件管理，通过 props 或 Context 共享。

---

### 6. 批量数据库操作没有事务
**文件：** `server/db.ts`

问题：`ScriptDB.update` 先 DELETE 再 INSERT 多行角色，全程无事务。如果 INSERT 到一半报错，数据库会处于中间状态。

**建议：** 用 `db.transaction()` 包裹：
```ts
await db.exec('BEGIN TRANSACTION');
try {
  await db.run('DELETE FROM script_player_roles WHERE script_id = ?', id);
  // ... inserts ...
  await db.exec('COMMIT');
} catch (e) {
  await db.exec('ROLLBACK');
  throw e;
}
```

---

### 7. 前端没有路由 — 无法导航
**文件：** `client/src/App.tsx`

问题：目前只有单页面，所有模块通过 Tab 切换显示。这种方式在小项目里能用，但随着功能增加（签到页面、管理后台、数据统计）会难以扩展。

**建议：** 引入 `react-router-dom`，按业务模块划分路由：
```
/ → 首页（日历）
/scripts → 剧本管理
/actors → 卡司管理
/rooms → 房间管理
/checkin/:scheduleId → 客户签到页
```

---

### 8. API 响应没有类型定义
**文件：** `client/src/hooks/useApi.ts`

问题：通用响应类型 `{ success: boolean; data?: T; error?: string }` 是隐式推断的，没有导出给组件用，导致组件里到处 `as any`。

**建议：** 显式导出并使用：
```ts
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}
```

---

## 🟡 P2 — 改进建议（长期价值）

### 9. 动态 SQL 构建存在隐患
**文件：** `server/db.ts` 第367-381行

问题：SET 子句通过字符串拼接 + `join` 构造，参数通过数组传入——逻辑上安全，但如果未来有人误改逻辑直接拼接字符串就有注入风险。

**建议：** 用更结构化的查询构建方式，或加注释警示。

---

### 10. `getActorAvailability` 查询有 N+1 风险
**文件：** `server/db.ts` 第481-492行

问题：`JOIN` 中 `rooms.name` 依赖 `s.room_id` 有值，但排期可能是待排期（无房间），会导致这些记录不出现。

**建议：** 改为 `LEFT JOIN rooms`，并明确处理无房间的情况。

---

### 11. 没有请求超时
**文件：** `useApi.ts`

问题：`fetch` 调用没有 `signal: AbortSignal`，网络问题时请求会无限挂起。

---

### 12. `start.ps1` 是批处理脚本，不是 PowerShell
**文件：** 项目根目录

问题：文件扩展名 `.ps1` 但内容是纯批处理（`cmd /c` 包装），误导性强。

---

### 13. 无测试
项目完全没有测试文件。建议按优先级：
1. 后端 ConflictChecker（核心业务逻辑）
2. 前端 useApi（最高复用频率）
3. ScheduleCalendar（最复杂组件）

---

## 📋 修复优先级总览

| 优先级 | 问题 | 预计工时 |
|--------|------|----------|
| P0-1 | 删除 .cjs 文件，统一 TS | 30 分钟 |
| P0-2 | 拆分 ScheduleCalendar | 3-4 小时 |
| P0-3 | 修复硬编码 IP | 10 分钟 |
| P1-4 | 重构 useApi / 引入 TanStack Query | 2 小时 |
| P1-5 | 合并重复轮询 | 1 小时 |
| P1-6 | 补充事务 | 1 小时 |
| P1-7 | 引入路由 | 2 小时 |
| P2 | 其余改进 | 持续迭代 |

---

## ✅ 做得好的地方

1. **后端结构清晰** — `db.ts` 按领域（RoomDB、ActorDB、ScriptDB...）组织，职责边界清楚
2. **ConflictChecker 独立** — 冲突检测逻辑抽离成独立模块，这是对的
3. **前后端分离** — API 风格一致，有统一的 `{ success, data, error }` 响应格式
4. **数据库外置** — SQLite 文件放在 `data/` 目录，不污染源码
5. **代码可读性** — 变量命名、注释、结构组织都比较规范
