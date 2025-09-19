# AI Foundry - 项目管理与Claude Code平台

基于 Next.js + TypeScript + PostgreSQL 构建的智能项目管理平台，集成 Claude Code AI 辅助开发功能。

## 🎯 项目概述

AI Foundry 是一个现代化的项目管理平台，结合了传统的项目和任务管理功能与强大的 AI 辅助编程能力。用户可以通过直观的Web界面管理项目，并利用集成的 Claude Code 进行智能编程辅助。

## ✨ 核心功能

### 📊 项目管理
- **项目列表**：创建、编辑、删除项目
- **项目详情**：项目描述、Git仓库链接
- **响应式界面**：适配各种屏幕尺寸

### 📋 任务管理
- **看板视图**：按状态分组（待处理、进行中、已完成、已取消）
- **任务操作**：创建、编辑、删除、状态更新
- **项目关联**：任务与项目的一对多关系

### 🤖 Claude Code 集成
- **聊天界面**：类似对话的AI交互体验
- **图片支持**：上传和粘贴图片功能
- **会话管理**：会话历史记录和恢复
- **权限控制**：多种权限模式选择

## 🏗️ 技术架构

### 前端技术栈
- **Next.js 15.5.3** - React框架（App Router）
- **React 19** - 最新React版本
- **TypeScript** - 类型安全开发
- **CSS Grid/Flexbox** - 响应式布局

### 后端技术栈
- **PostgreSQL** - 关系型数据库
- **Drizzle ORM** - 现代TypeScript ORM
- **Next.js API Routes** - 服务端API处理
- **@anthropic-ai/claude-code** - Claude Code SDK

### 开发工具
- **Docker** - 容器化部署
- **pnpm** - 高效包管理器
- **Drizzle Studio** - 数据库可视化工具

## 🚀 快速开始

### 前提条件
- Node.js 18+
- pnpm
- Docker（推荐）

### 1. 克隆项目

```bash
git clone <your-repo-url>
cd ai-foundry
pnpm install
```

### 2. 数据库设置

**使用Docker（推荐）：**
```bash
# 启动PostgreSQL容器
docker run --name ai-foundry-postgres \
  -e POSTGRES_PASSWORD=password \
  -e POSTGRES_DB=ai_foundry \
  -p 5432:5432 \
  -d postgres:15
```

### 3. 环境配置

```bash
# 复制环境变量模板
cp .env.local.example .env.local

# 编辑 .env.local，设置数据库连接
# DATABASE_URL="postgresql://postgres:password@localhost:5432/ai_foundry"
```

### 4. 初始化数据库

```bash
# 创建数据库表
pnpm run db:push --force
```

### 5. 启动应用

```bash
# 启动开发服务器
pnpm run dev
```

## 📖 文档

- 📚 **[快速开始指南](./docs/quick-start.md)** - 5分钟快速上手
- 🛠️ **[数据库设置指南](./docs/database-setup.md)** - 详细的数据库配置说明

## 🌐 访问地址

- 🏠 **项目管理首页**: http://localhost:3000
- 💬 **Claude Code聊天**: http://localhost:3000/chat
- 📊 **数据库管理**: `pnpm run db:studio`

## 📁 项目结构

```
ai-foundry/
├── app/
│   ├── api/                    # API路由
│   │   ├── claude-code/        # Claude Code集成
│   │   ├── projects/           # 项目管理API
│   │   └── tasks/              # 任务管理API
│   ├── components/             # React组件
│   ├── chat/                   # Claude Code聊天页面
│   ├── projects/[id]/          # 项目详情页面
│   ├── layout.tsx              # 根布局
│   └── page.tsx                # 首页
├── lib/
│   ├── api/                    # API客户端
│   ├── db/                     # 数据库配置
│   └── types/                  # TypeScript类型定义
├── docs/                       # 项目文档
├── drizzle/                    # 数据库迁移文件
├── drizzle.config.ts           # Drizzle配置
└── README.md                   # 项目说明
```

## 🗄️ 数据库Schema

### projects 表
- `id` (UUID) - 项目唯一标识
- `name` (VARCHAR) - 项目名称
- `description` (TEXT) - 项目描述
- `repository_url` (VARCHAR) - Git仓库地址
- `created_at`, `updated_at` - 时间戳

### tasks 表
- `id` (UUID) - 任务唯一标识
- `project_id` (UUID) - 关联项目ID
- `description` (TEXT) - 任务描述
- `status` (VARCHAR) - 任务状态
- `created_at`, `updated_at` - 时间戳

## 🔧 开发命令

### 应用运行
```bash
pnpm run dev              # 启动开发服务器
pnpm run build            # 构建生产版本
pnpm run start            # 启动生产服务器
pnpm run lint             # 代码检查
```

### 数据库管理
```bash
pnpm run db:push          # 推送schema变更
pnpm run db:generate      # 生成迁移文件
pnpm run db:migrate       # 执行迁移
pnpm run db:studio        # 打开数据库管理界面
```

### Docker管理
```bash
docker start ai-foundry-postgres    # 启动数据库
docker stop ai-foundry-postgres     # 停止数据库
docker logs ai-foundry-postgres     # 查看数据库日志
```

## 🎛️ 使用指南

### 项目管理
1. 在首页点击"新建项目"创建项目
2. 填写项目名称、描述和Git仓库地址
3. 点击项目卡片进入项目详情页面

### 任务管理
1. 在项目详情页面点击"新建任务"
2. 填写任务描述并选择状态
3. 使用编辑和删除功能管理任务

### Claude Code助手
1. 访问 `/chat` 页面
2. 在输入框中输入问题或任务
3. 选择合适的权限模式
4. 享受AI辅助编程体验

## 🚨 注意事项

- **数据安全**：重要数据请定期备份
- **权限控制**：在生产环境中谨慎使用完全权限模式
- **网络要求**：Claude Code功能需要稳定的网络连接

## 🤝 贡献指南

欢迎提交 Issue 和 Pull Request！

1. Fork 项目
2. 创建功能分支
3. 提交代码更改
4. 创建 Pull Request

## 📄 许可证

ISC License

## 🎉 致谢

- **Claude Code SDK** - AI辅助编程能力
- **Drizzle ORM** - 现代化数据库工具
- **Next.js** - 强大的React框架

---

**Powered by Claude Code & Next.js** | **Built with ❤️ and TypeScript**