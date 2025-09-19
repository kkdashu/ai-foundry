# 快速开始 🚀

## 5分钟启动项目

### 1. 克隆并安装依赖

```bash
git clone <your-repo-url>
cd ai-foundry
pnpm install
```

### 2. 启动数据库（Docker方式）

```bash
# 启动PostgreSQL容器
docker run --name ai-foundry-postgres \
  -e POSTGRES_PASSWORD=password \
  -e POSTGRES_DB=ai_foundry \
  -p 5432:5432 \
  -d postgres:15
```

### 3. 配置环境变量

```bash
# 复制环境变量模板
cp .env.local.example .env.local

# .env.local 内容：
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

## 访问应用

- 🏠 **首页（项目管理）**: http://localhost:3000
- 💬 **聊天界面**: http://localhost:3000/chat
- 📊 **数据库管理**: `pnpm run db:studio`

## 功能特性

### ✅ 项目管理
- 创建、编辑、删除项目
- 项目描述和Git仓库链接
- 项目列表和详情页面

### ✅ 任务管理
- 看板式任务管理（待处理、进行中、已完成、已取消）
- 创建、编辑、删除任务
- 任务状态拖拽更新

### ✅ Claude Code集成
- 完整的Claude Code聊天界面
- 图片上传和粘贴支持
- 会话管理和历史记录

### ✅ 技术栈
- **前端**: Next.js 15 + React 19 + TypeScript
- **数据库**: PostgreSQL + Drizzle ORM
- **部署**: Docker支持

## 常用命令

```bash
# 开发
pnpm run dev              # 启动开发服务器
pnpm run build            # 构建生产版本
pnpm run start            # 启动生产服务器

# 数据库
pnpm run db:push          # 推送schema变更
pnpm run db:generate      # 生成迁移文件
pnpm run db:migrate       # 执行迁移
pnpm run db:studio        # 打开数据库管理界面

# Docker
docker start ai-foundry-postgres    # 启动数据库
docker stop ai-foundry-postgres     # 停止数据库
docker logs ai-foundry-postgres     # 查看数据库日志
```

## 故障排除

### 端口被占用
```bash
# 如果3000端口被占用，应用会自动使用下一个可用端口
# 查看终端输出确认实际端口号
```

### 数据库连接失败
```bash
# 检查Docker容器状态
docker ps

# 重启数据库容器
docker restart ai-foundry-postgres
```

### 需要重置数据库
```bash
# 删除并重新创建容器
docker rm -f ai-foundry-postgres

# 重新运行启动命令
docker run --name ai-foundry-postgres \
  -e POSTGRES_PASSWORD=password \
  -e POSTGRES_DB=ai_foundry \
  -p 5432:5432 \
  -d postgres:15

# 重新初始化数据库
pnpm run db:push --force
```

## 下一步

1. 📖 阅读完整的 [数据库设置指南](./database-setup.md)
2. 🔧 了解项目架构和代码结构
3. 🚢 部署到生产环境

---

**需要帮助？** 请查看详细文档或提交Issue。