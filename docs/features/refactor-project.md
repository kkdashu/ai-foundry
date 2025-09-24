# 重构项目结构（引入 Landmark/里程碑）

当前 Project 下直接挂 Task。目标是引入 Landmark（里程碑）层级：Project → Landmark → Task。

目标：
- 在数据库中增加 `landmarks` 表，并将 `tasks` 与 `landmarks` 建立关联（新增 `landmarkId`）。
- 后端 API 与类型同步更新（tRPC + Zod + Drizzle）。
- 前端项目详情页：先渲染所有 Landmark，再在各 Landmark 下渲染其 Task；支持创建/编辑/删除 Landmark；新建 Task 时需选择 Landmark。

---

## 数据库设计与迁移

新增表：`landmarks`
- `id`: UUID, PK, 默认随机
- `projectId`: UUID, 非空，外键引用 `projects.id`，`onDelete: 'cascade'`
- `name`: varchar(255), 非空
- `createdAt`: timestamp, 默认 `now()`
- `updatedAt`: timestamp, 默认 `now()`
- `completedAt`: timestamp, 可空

变更表：`tasks`
- 新增列 `landmarkId`: UUID，可空（迁移阶段方便回填），外键引用 `landmarks.id`
  - 推荐 `onDelete: 'set null'`（避免误删 Landmark 导致连带删除 Task；后续可在 UI 层提供“移动任务到其他 Landmark”）

索引建议：
- `landmarks(project_id)` 普通索引
- 可选：`unique(project_id, name)` 防止同项目内 Landmark 重名（按需）
- `tasks(landmark_id)` 普通索引

Drizzle 变更点：
- `lib/db/schema.ts` 新增 `landmarks` 表与 relations；在 `tasks` 上新增 `landmarkId` 外键与 relations。
- 导出 `Landmark/NewLandmark` 类型。

迁移步骤（建议顺序）：
1) 在 `lib/db/schema.ts` 定义 `landmarks` 表与 `tasks.landmarkId` 列（可空）。
2) 生成并执行迁移：
   - `npx drizzle-kit generate`
   - `npx drizzle-kit push`
3) 数据回填（可选）：将现有 `tasks.landmark_id` 批量设置为某个默认 Landmark（例如“未分组”）。
4) 待前端/后端全面切换后，如需强约束，再将 `tasks.landmarkId` 改为非空并生成后续迁移。

---

## 后端 API（tRPC）与类型调整

新增 router：`server/routers/landmarks.ts`
- `listByProject({ projectId })` → 返回项目下的所有 Landmarks
- `create({ projectId, name })` → 新建 Landmark
- `update({ id, name, completedAt? })` → 更新 Landmark
- `delete({ id })` → 删除 Landmark（考虑是否阻止在有任务时删除，或采用“置空/移动任务”策略）

调整现有 `tasks` router（`server/routers/tasks.ts`）：
- `list` 支持 `projectId`、可选 `landmarkId` 过滤
- `create` 支持 `landmarkId`（可空兼容，前端完成改造后设为必填）
- 其他接口在类型层面同步携带 `landmarkId`

Zod/TS 类型：
- `lib/api/schemas.ts`
  - 新增 `LandmarkSchema` / `NewLandmarkSchema`
  - 在 `TaskSchema`/`NewTaskSchema` 中加入 `landmarkId`（先可选，迁移后可改必选）
- `lib/types/api.ts`
  - 新增 `Landmark`、`NewLandmark` 接口
  - 在 `Task`、`NewTask` 中加入 `landmarkId`

关系映射（Drizzle）：
- `projects` → `landmarks` 一对多
- `landmarks` → `tasks` 一对多

---

## 前端改造

页面 `app/projects/[id]/page.tsx`：
- 加载数据：并行加载 `project`、`landmarks(listByProject)`、`tasks(list)`。
- 展示结构：先按 Landmark 分组展示任务；每个 Landmark 卡片下显示其 Tasks（再按状态分组可保留）。
- 交互新增：
  - 新建/编辑/删除 Landmark（名称、可选完成时间）。
  - 新建 Task 时需选择 Landmark（使用下拉选择现有 Landmark）。
  - Task 列表支持按 Landmark 筛选/跳转。
- 兼容期策略：若 `landmarkId` 为空，显示在“未分组”分区，并提供“移动到 Landmark”操作。

组件/状态：
- 复用现有任务的增删改处理，新增 Landmark 的 CRUD 处理逻辑与 UI。
- ChatBox、Local Path 仍绑定 Project 级别，无需改动。

---

## 回滚与风控
- 数据库：先以可空列上线，完成应用切换与数据回填后再加非空约束，降低失败风险。
- 删除 Landmark 的策略需谨慎：默认阻止删除含任务的 Landmark，或强制要求先迁移任务。
- 执行迁移前做好数据库备份；生产环境采用灰度发布。

---

## 验收标准
- 可在项目详情页看到 Landmark 列表；每个 Landmark 下展示对应任务。
- 可创建/编辑/删除 Landmark，并能为任务选择/变更 Landmark。
- `tasks.list` 支持 `landmarkId` 过滤；`tasks.create` 接受 `landmarkId`。
- 所有相关类型与 Schema 校验通过；Drizzle 迁移可成功执行。

---

## 任务清单
- [ ] DB：`lib/db/schema.ts` 新增 `landmarks` 表与 relations
- [ ] DB：`tasks` 新增 `landmarkId` 外键（可空）与索引
- [ ] 迁移：生成与执行 Drizzle 迁移脚本
- [ ] 类型：`lib/api/schemas.ts` 新增 Landmark 模型并扩展 Task
- [ ] 类型：`lib/types/api.ts` 新增 `Landmark`/`NewLandmark` 并扩展 `Task`
- [ ] 后端：新增 `server/routers/landmarks.ts`
- [ ] 后端：扩展 `server/routers/tasks.ts` 支持 `landmarkId`
- [ ] 前端：`app/projects/[id]/page.tsx` 加载并展示 Landmark → Task
- [ ] 前端：新增 Landmark 的创建/编辑/删除 UI 与逻辑
- [ ] 前端：新建 Task 表单中增加 Landmark 选择
- [ ] 数据：旧数据回填（默认 Landmark）
- [ ] 文档：更新 `docs/quick-start.md`（如需）与相关说明

---

## 附：TypeScript 接口草案

```typescript
// Landmark（里程碑）
interface Landmark {
  id: string
  projectId: string
  name: string
  createdAt: Date
  updatedAt: Date
  completedAt?: Date | null
}

// Task（新增 landmarkId）
interface Task {
  id: string
  projectId: string
  landmarkId?: string | null
  description: string
  status: string
  createdAt: Date
  updatedAt: Date
}
```
