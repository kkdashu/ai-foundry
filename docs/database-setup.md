# 数据库初始化指南

本文档将指导你如何设置和初始化项目所需的PostgreSQL数据库。

## 前提条件

- 已安装 Node.js (>= 18)
- 已安装 pnpm
- 已安装 Docker（推荐）或本地PostgreSQL

## 方法一：使用Docker（推荐）

### 1. 启动PostgreSQL容器

```bash
# 创建并启动PostgreSQL容器
docker run --name ai-foundry-postgres \
  -e POSTGRES_PASSWORD=password \
  -e POSTGRES_DB=ai_foundry \
  -p 5432:5432 \
  -d postgres:15
```

### 2. 验证容器运行状态

```bash
# 检查容器是否正在运行
docker ps

# 应该看到类似输出：
# CONTAINER ID   IMAGE         COMMAND                   CREATED         STATUS         PORTS                    NAMES
# 42d0320b7ae0   postgres:15   "docker-entrypoint.s…"   8 seconds ago   Up 7 seconds   0.0.0.0:5432->5432/tcp   ai-foundry-postgres
```

### 3. 配置环境变量

```bash
# 复制环境变量模板
cp .env.local.example .env.local

# 编辑 .env.local 文件，设置数据库连接字符串
# DATABASE_URL="postgresql://postgres:password@localhost:5432/ai_foundry"
```

### 4. 运行数据库迁移

```bash
# 安装依赖（如果还没有安装）
pnpm install

# 推送数据库schema到PostgreSQL
pnpm run db:push --force
```

### 5. 启动应用

```bash
# 启动开发服务器
pnpm run dev
```

## 方法二：使用本地PostgreSQL安装

### 1. 安装PostgreSQL

**macOS (使用Homebrew):**
```bash
brew install postgresql
brew services start postgresql
```

**Ubuntu/Debian:**
```bash
sudo apt update
sudo apt install postgresql postgresql-contrib
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

**Windows:**
下载并安装 PostgreSQL 官方安装包：https://www.postgresql.org/download/windows/

### 2. 创建数据库和用户

```bash
# 连接到PostgreSQL
sudo -u postgres psql

# 在PostgreSQL命令行中执行：
CREATE DATABASE ai_foundry;
CREATE USER your_username WITH ENCRYPTED PASSWORD 'your_password';
GRANT ALL PRIVILEGES ON DATABASE ai_foundry TO your_username;
\q
```

### 3. 配置环境变量

创建 `.env.local` 文件：

```bash
cp .env.local.example .env.local
```

编辑 `.env.local` 文件，设置你的数据库连接信息：

```env
DATABASE_URL="postgresql://your_username:your_password@localhost:5432/ai_foundry"
```

### 4. 运行迁移和启动应用

```bash
# 推送数据库schema
pnpm run db:push --force

# 启动开发服务器
pnpm run dev
```

## 数据库Schema

项目使用以下数据库表结构：

### projects 表
- `id` (UUID, 主键) - 项目唯一标识符
- `name` (VARCHAR) - 项目名称
- `description` (TEXT) - 项目描述
- `repository_url` (VARCHAR, 可选) - Git仓库地址
- `created_at` (TIMESTAMP) - 创建时间
- `updated_at` (TIMESTAMP) - 更新时间

### tasks 表
- `id` (UUID, 主键) - 任务唯一标识符
- `project_id` (UUID, 外键) - 关联的项目ID
- `description` (TEXT) - 任务描述
- `status` (VARCHAR) - 任务状态 (pending, in_progress, completed, cancelled)
- `created_at` (TIMESTAMP) - 创建时间
- `updated_at` (TIMESTAMP) - 更新时间

## 常用数据库命令

### Docker容器管理

```bash
# 启动已存在的容器
docker start ai-foundry-postgres

# 停止容器
docker stop ai-foundry-postgres

# 重启容器
docker restart ai-foundry-postgres

# 查看容器日志
docker logs ai-foundry-postgres

# 连接到容器内的PostgreSQL
docker exec -it ai-foundry-postgres psql -U postgres -d ai_foundry

# 删除容器（危险操作，会丢失所有数据）
docker rm -f ai-foundry-postgres
```

### Drizzle 命令

```bash
# 生成新的迁移文件
pnpm run db:generate

# 推送schema变更到数据库
pnpm run db:push

# 执行迁移
pnpm run db:migrate

# 打开Drizzle Studio（数据库可视化工具）
pnpm run db:studio
```

## 故障排除

### 端口冲突
如果端口5432已被占用：

```bash
# 查看占用端口的进程
lsof -i :5432

# 停止占用的服务或使用不同端口
docker run --name ai-foundry-postgres \
  -e POSTGRES_PASSWORD=password \
  -e POSTGRES_DB=ai_foundry \
  -p 5433:5432 \
  -d postgres:15

# 相应地更新 .env.local 中的端口号
# DATABASE_URL="postgresql://postgres:password@localhost:5433/ai_foundry"
```

### 连接问题
如果无法连接到数据库：

1. 确认PostgreSQL容器正在运行：`docker ps`
2. 检查环境变量是否正确设置
3. 确认防火墙没有阻止连接
4. 查看Docker容器日志：`docker logs ai-foundry-postgres`

### 权限问题
如果遇到权限错误：

```bash
# 重新创建容器并设置适当的权限
docker rm -f ai-foundry-postgres
docker run --name ai-foundry-postgres \
  -e POSTGRES_PASSWORD=password \
  -e POSTGRES_DB=ai_foundry \
  -e POSTGRES_USER=postgres \
  -p 5432:5432 \
  -d postgres:15
```

## 开发环境 vs 生产环境

### 开发环境
- 使用本地Docker容器或本地PostgreSQL安装
- 数据可以随时重置
- 使用 `pnpm run db:push` 快速同步schema

### 生产环境
- 使用托管的PostgreSQL服务（如AWS RDS、Supabase、Railway等）
- 使用 `pnpm run db:migrate` 进行版本化迁移
- 确保定期备份数据

## 备份和恢复

### 备份数据库

```bash
# 备份整个数据库
docker exec ai-foundry-postgres pg_dump -U postgres ai_foundry > backup.sql

# 备份特定表
docker exec ai-foundry-postgres pg_dump -U postgres -t projects -t tasks ai_foundry > backup.sql
```

### 恢复数据库

```bash
# 恢复数据库
docker exec -i ai-foundry-postgres psql -U postgres ai_foundry < backup.sql
```

## 数据库监控

推荐使用 Drizzle Studio 进行数据库可视化：

```bash
# 启动Drizzle Studio
pnpm run db:studio
```

这将在浏览器中打开一个可视化界面，你可以：
- 查看表结构
- 浏览和编辑数据
- 执行SQL查询
- 监控数据库性能

## 总结

按照本指南，你应该能够成功设置和运行项目的PostgreSQL数据库。如果遇到任何问题，请检查故障排除部分或查看项目的GitHub Issues。