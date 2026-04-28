# script-scheduler 代码规范

> 适用团队：1-3人 MVP 阶段
> 最后更新：2026-04-18
> 规范依据：已有代码 + 审查发现的问题

---

## 一、项目结构

```
script-scheduler/
├── client/                    # 前端（React）
│   └── src/
│       ├── api/               # ★ 新增：API 调用层
│       │   ├── client.ts      # fetch 封装、响应类型
│       │   ├── scripts.ts     # 剧本相关 API
│       │   ├── actors.ts      # 卡司相关 API
│       │   ├── schedules.ts   # 排期相关 API
│       │   └── rooms.ts       # 房间相关 API
│       ├── components/         # 组件（按功能模块分目录）
│       │   ├── ScriptManager/
│       │   │   ├── index.tsx
│       │   │   ├── ScriptForm.tsx
│       │   │   ├── ScriptDetail.tsx
│       │   │   └── ScriptCard.tsx
│       │   ├── ActorManager/
│       │   ├── RoomManager/
│       │   ├── ScheduleCalendar/
│       │   └── CheckInPage/
│       ├── hooks/              # 自定义 Hooks
│       ├── pages/              # 页面（路由入口）
│       ├── types/              # 全局 TypeScript 类型
│       ├── utils/              # 纯工具函数
│       └── config.ts           # 环境变量配置
│
├── server/                    # 后端（Express + SQLite）
│   ├── routes/                # ★ 改造：按模块分路由文件
│   │   ├── scripts.ts
│   │   ├── actors.ts
│   │   ├── schedules.ts
│   │   └── rooms.ts
│   ├── db/                   # ★ 新增：数据库相关
│   │   ├── index.ts          # initDb、getDb
│   │   ├── schema.sql        # ★ 新增：建表语句（SQL 文件）
│   │   └── repositories/      # ★ 改造：每个表一个 repository
│   │       ├── scripts.ts
│   │       ├── actors.ts
│   │       ├── schedules.ts
│   │       └── rooms.ts
│   ├── services/             # ★ 新增：业务逻辑层
│   │   └── conflict.ts       # 冲突检测
│   └── index.ts              # 入口（只做路由挂载）
│
├── data/                     # 数据库文件（不提交 Git）
├── .env.example              # 环境变量模板
└── package.json
```

**原则：每个文件 ≤ 200 行，每个目录 ≤ 10 个文件。**

---

## 二、文件命名

| 类型 | 规范 | 示例 |
|------|------|------|
| React 组件 | PascalCase.tsx | `ScriptManager.tsx` |
| 工具函数/hooks | camelCase.ts | `useApi.ts` |
| API 模块 | camelCase.ts | `scripts.ts` |
| TypeScript 类型 | camelCase.ts | `types/index.ts` |
| 数据库表 | snake_case（SQL 约定） | `schedules`, `actor_skills` |
| 状态管理文件 | camelCase.ts | `scheduleStore.ts` |
| 样式文件 | 同名组件.css / .module.css | `ScheduleModal.module.css` |

---

## 三、TypeScript 规范

### 3.1 禁止使用 `any`

```ts
// ❌ 禁止
const data: any = fetchData();

// ✅ 正确：定义接口或用 unknown
const data: unknown = fetchData();
if (typeof data === 'string') { ... }
```

### 3.2 接口定义位置

```
types/index.ts       ← 全局共享的类型（API 响应、数据库模型）
components/XXX/types.ts  ← 组件私有类型（UI 状态等）
```

### 3.3 API 响应类型（必须统一）

```ts
// 统一响应格式
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

// 组件中这样使用：
const res = await get<Script[]>('/scripts');
if (res.success && res.data) {
  setScripts(res.data);  // data 类型正确，无需 as any
}
```

### 3.4 禁止在组件中写接口类型

```ts
// ❌ 禁止：组件内部写接口
function Foo() {
  interface LocalData { id: string; name: string }  // 不要这样
}

// ✅ 正确：抽取到 types/index.ts
interface LocalData { id: string; name: string }
```

---

## 四、前端规范（React）

### 4.1 组件拆分标准

**触发拆分的信号（任一满足即拆）：**

| 信号 | 阈值 | 操作 |
|------|------|------|
| 文件行数 | > 200 行 | 拆分子组件 |
| useState 数量 | > 8 个 | 拆分子组件或抽 hooks |
| JSX 分支（if/else 渲染） | > 3 种 | 拆分为独立组件 |
| API 调用数量 | > 2 个 | 抽到 api/ 目录或用 React Query |
| 重复代码块 | 出现第2次 | 抽组件或工具函数 |

### 4.2 组件结构顺序（强制）

```tsx
export default function MyComponent() {
  // 1. hooks（状态 + 副作用）
  const { get } = useApi();
  const [data, setData] = useState<Data[]>([]);

  // 2. 业务函数
  const handleSubmit = async () => { ... };

  // 3. 辅助渲染函数（可选）
  const renderStatus = (status: string) => { ... };

  // 4. 子组件定义（可选，用于非常小的纯渲染单元）
  const Item = ({ name }: { name: string }) => <div>{name}</div>;

  // 5. 主渲染（最后）
  return ( ... );
}
```

### 4.3 Hooks 规范

- 一个 hook 只做一件事
- hooks 放在 `hooks/` 目录
- 通用 hook 命名：`use[功能]`，如 `useSchedulePolling`

```ts
// ✅ 正确：单一职责
export function useSchedulePolling(scheduleId: string) {
  const [checkins, setCheckins] = useState([]);
  // ...
}

// ❌ 错误：一个 hook 做多件事
export function useScheduleData(id, withActors, withCheckins, autoRefresh) { ... }
```

### 4.4 API 调用规范

**禁止在组件内部直接写 fetch**，统一调用 api/ 目录下的模块：

```ts
// ❌ 禁止
const res = await fetch('/api/scripts');

// ✅ 正确
import { getScripts } from '../api/scripts';
const scripts = await getScripts();
```

**api/ 目录结构：**

```ts
// client/src/api/scripts.ts
import { apiClient } from './client';

export async function getScripts() {
  return apiClient.get<Script[]>('/scripts');
}

export async function createScript(data: CreateScriptInput) {
  return apiClient.post<{ id: string }>('/scripts', data);
}

// client/src/api/client.ts
export const apiClient = {
  async get<T>(url: string) { ... },
  async post<T>(url: string, data: unknown) { ... },
  async put<T>(url: string, data: unknown) { ... },
  async del<T>(url: string) { ... },
};
```

### 4.5 样式规范

- 使用 Tailwind CSS 作为默认
- 组件样式写在 JSX 的 className 中（Tailwind）
- 复杂样式（> 3 行动画、多条件样式）用 CSS Modules

---

## 五、后端规范（Express + SQLite）

### 5.1 分层架构（必须遵守）

```
路由层 (routes/)   → 接收请求，参数校验，调用 service
业务层 (services/)  → 业务逻辑（冲突检测、状态流转）
数据层 (repositories/) → 数据库操作（只做 CRUD）
```

**禁止在路由层写业务逻辑**，禁止在 repository 层写 if/else 业务判断。

### 5.2 路由文件结构

```ts
// server/routes/scripts.ts
import { Router } from 'express';
import { ScriptRepository } from '../db/repositories/scripts';
import { ActorSkillRepository } from '../db/repositories/actorSkills';

const router = Router();
const repo = new ScriptRepository();

router.get('/', async (req, res) => {
  // 简单查询直接放路由
  const scripts = await repo.findAll();
  res.json({ success: true, data: scripts });
});

router.post('/', async (req, res) => {
  // 复杂创建逻辑 → 抽到 service
  const { name, duration } = req.body;
  if (!name || !duration) {
    return res.status(400).json({ success: false, error: '缺少必填字段' });
  }
  const id = await repo.create({ name, duration });
  res.json({ success: true, data: { id } });
});

export default router;
```

### 5.3 错误处理

```ts
// ✅ 统一错误处理格式
try {
  const script = await repo.findById(id);
  if (!script) {
    return res.status(404).json({ success: false, error: '剧本不存在' });
  }
  // ...
} catch (error) {
  console.error('[ScriptAPI] getById error:', error);
  res.status(500).json({ success: false, error: '服务器内部错误' });
}
```

### 5.4 事务规范

**涉及多表写入，必须用事务：**

```ts
import { getDb } from '../db';

async function updateScriptWithRoles(id: string, data: UpdateData) {
  const db = await getDb();
  await db.exec('BEGIN TRANSACTION');
  try {
    await db.run('UPDATE scripts SET name = ? WHERE id = ?', data.name, id);
    await db.run('DELETE FROM script_player_roles WHERE script_id = ?', id);
    for (const role of data.playerRoles) {
      await db.run('INSERT INTO script_player_roles ...', ...);
    }
    await db.exec('COMMIT');
  } catch (e) {
    await db.exec('ROLLBACK');
    throw e;
  }
}
```

### 5.5 禁止行为

```ts
// ❌ 禁止：SELECT * 泛查
const all = await db.all('SELECT * FROM schedules');

// ✅ 正确：明确字段
const all = await db.all(
  'SELECT id, script_id, start_time FROM schedules WHERE status = ?',
  ['pending']
);
```

---

## 六、环境配置

### 6.1 环境变量（必须使用 .env）

```
# .env.example（提交到 Git）
PORT=3000
DB_PATH=./data/scheduler.db
API_BASE_URL=http://localhost:5173
```

```
# .env（不提交到 Git）
PORT=3000
DB_PATH=./data/scheduler.db
API_BASE_URL=http://192.168.1.12:5173
```

### 6.2 前端环境变量

```ts
// vite.config.ts
export default defineConfig({
  server: {
    proxy: {
      '/api': 'http://localhost:3000',
    },
  },
});

// 代码中使用
const API_BASE = import.meta.env.VITE_API_BASE_URL || window.location.origin;
```

---

## 七、Git 规范

### 7.1 分支命名

```
feature/[功能名]          # 新功能
fix/[问题描述]            # Bug 修复
refactor/[模块名]         # 重构
chore/[其他]              # 工具/配置改动
```

示例：`feature/schedule-calendar-refactor`、`fix/qr-code-hardcoded-ip`

### 7.2 Commit 信息格式

```
[类型] 简短描述

类型：feat / fix / refactor / style / test / chore
```

示例：
```
[feat] 新增剧本角色管理功能
[fix] 修复硬编码 IP 导致二维码无法访问的问题
[refactor] 拆分 ScheduleCalendar 为独立子组件
```

### 7.3 禁止的 Commit

```
❌ "update"
❌ "fix bug"
❌ "changes"
❌ "WIP"
```

每个 commit 必须能独立 revert 有意义。

---

## 八、Code Review 流程

### 8.1 提交前自检清单

- [ ] 新文件不超过 200 行
- [ ] 没有任何 `any` 类型
- [ ] 没有 SELECT *
- [ ] API 调用通过 api/ 目录
- [ ] 有 CRUD 的地方检查了事务
- [ ] 硬编码的值移到配置/环境变量

### 8.2 Review 要看什么

**Reviewer 必须检查（必须）：**

1. **逻辑正确性** — 这个改动会不会引入 Bug？
2. **安全性** — 有没有 SQL 注入、XSS、敏感信息暴露？
3. **一致性** — 命名、风格是否与项目一致？
4. **可测试性** — 这个逻辑能单独测试吗？

**Reviewer 应该建议（鼓励）：**

5. 是否有重复代码可以抽？
6. 是否有更简洁的实现方式？
7. 类型定义是否完整？

### 8.3 Review 态度

- **对事不对人**：说"这段代码有风险"不说"你写的有问题"
- **具体化**：说"这里用 SELECT * 会返回不需要的字段，影响性能"不说"不要用 SELECT *"
- **给出方案**：指出问题时同时给出建议的改法

---

## 九、数据库规范

### 9.1 表命名

- 表名单数：`script` 不是 `scripts`
- 关系表：`schedule_actor`（中间表不加 `_rel`）
- 索引命名：`idx_[表名]_[字段名]`

### 9.2 字段规范

- 所有表必须有 `id`（TEXT UUID）作为主键
- 时间字段：`created_at DATETIME DEFAULT CURRENT_TIMESTAMP`
- 软删除用 `deleted_at`（DATETIME NULL）
- 外键必须加 `ON DELETE CASCADE/SET NULL`

---

## 十、待删除遗留文件

| 文件 | 说明 | 删除时间 |
|------|------|----------|
| `server/index.cjs` | CommonJS 旧版，与 index.ts 重复 | 下次重构时 |
| `server/db.cjs` | CommonJS 旧版，与 db.ts 重复 | 下次重构时 |
| `启动系统.bat` | 中文名批处理，迁移到 start.ps1 | 下次重构时 |
| `清理并启动.bat` | 同上 | 下次重构时 |

---

## 规范违反处理

| 级别 | 处理方式 |
|------|----------|
| P0 违规（any、硬编码 IP、无事务批量操作） | Review 时必须打回 |
| P1 违规（文件超200行、SELECT *） | Review 时指出，PR 通过前修复 |
| P2 违规（命名不规范、注释缺失） | Review 时建议，下次提 PR 时修复 |

---

*本规范随项目演进持续更新。修改前先讨论，统一认知。*
