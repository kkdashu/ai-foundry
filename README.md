# Claude Code Web Interface

基于 Next.js + TypeScript 构建的 Claude Code Web 界面，将命令行工具转换为用户友好的网页应用。

## 🎯 项目概述

Claude Code Web Interface 是一个现代化的 Web 应用，它将强大的 Claude Code CLI 工具包装成直观易用的浏览器界面。用户可以通过聊天式的交互方式享受 AI 辅助编程的便利，无需使用命令行。

## 🏗️ 技术架构

### 前端技术栈
- **Next.js 15.5.3** - React 框架（App Router）
- **TypeScript** - 类型安全开发
- **CSS** - 暗色主题界面设计

### 后端集成
- **@anthropic-ai/claude-code** - 官方 Claude Code SDK
- **Next.js API Routes** - 服务端 API 处理

## 🚀 核心功能

### 1. Claude Code SDK 集成
- 完整的 SDK 功能封装
- 异步消息流处理
- 错误处理和状态管理

### 2. 上下文共享
- **会话继续** (`continue: true`) - 保持对话历史
- **会话恢复** (`resume: sessionId`) - 通过 ID 恢复特定会话
- **实时会话跟踪** - 显示当前会话状态

### 3. 权限管理
提供四种权限模式：
- `bypassPermissions` - **完全权限**（默认）- 可修改任何文件
- `acceptEdits` - 自动接受编辑操作
- `default` - 标准权限行为
- `plan` - 仅规划模式，不执行操作

### 4. 用户界面
- **聊天式界面** - 类似对话的交互体验
- **实时状态显示** - 加载状态、会话信息
- **会话控制面板** - 上下文开关、权限选择、会话清除
- **响应式设计** - 适配不同屏幕尺寸

## 📁 项目结构

```
project-maker/
├── app/
│   ├── api/claude-code/
│   │   └── route.ts          # Claude Code API 集成
│   ├── layout.tsx            # 根布局组件
│   ├── page.tsx              # 主页面组件
│   └── globals.css           # 全局样式
├── next.config.js            # Next.js 配置
├── package.json              # 项目依赖
├── tsconfig.json             # TypeScript 配置
└── README.md                 # 项目文档
```

## 🛠️ 安装和运行

### 环境要求
- Node.js 18+
- npm 或 yarn

### 安装依赖
```bash
npm install
```

### 开发模式
```bash
npm run dev
```
访问 http://localhost:3000

### 生产构建
```bash
npm run build
npm run start
```

## 🎛️ 使用指南

### 基本使用
1. 在输入框中输入你的问题或任务
2. 点击"发送"按钮或按 Enter 键
3. Claude Code 将处理你的请求并显示响应

### 上下文管理
- **继续对话上下文**：勾选此选项以保持对话历史
- **会话ID**：显示当前会话的唯一标识符
- **清除会话**：重置对话历史和会话状态

### 权限设置
选择合适的权限模式：
- **完全权限**：允许 Claude 修改任何文件（推荐用于开发）
- **自动接受编辑**：自动确认文件修改操作
- **默认权限**：标准安全模式
- **仅规划**：只生成计划，不执行操作

## ✨ 功能特性

### 输入方式
- 多行文本输入框
- Enter 发送消息
- Shift+Enter 换行
- 实时加载状态

### 输出展示
- 用户消息（右侧蓝色气泡）
- Claude 响应（左侧灰色气泡）
- 时间戳显示
- 代码语法高亮

### 技术特性
- **安全性**：权限模式动态控制
- **性能**：异步消息流处理
- **扩展性**：模块化 API 设计
- **类型安全**：全栈 TypeScript 支持

## 🎯 使用场景

1. **代码开发**
   - 文件编辑和代码重构
   - 依赖管理和配置
   - Bug 修复和优化

2. **项目管理**
   - 配置文件修改
   - 脚本执行和部署
   - 构建流程优化

3. **学习探索**
   - 代码解释和分析
   - 最佳实践建议
   - 技术方案讨论

4. **快速原型**
   - 功能快速实现
   - 测试用例编写
   - API 接口开发

## 🔧 开发说明

### API 接口
主要 API 端点：`/api/claude-code`

请求格式：
```json
{
  "prompt": "用户输入的问题",
  "continue": true,
  "sessionId": "会话ID",
  "permissionMode": "bypassPermissions"
}
```

响应格式：
```json
{
  "messages": [...],
  "sessionId": "新的会话ID",
  "success": true
}
```

### 环境变量
确保已配置 Claude Code CLI 认证：
```bash
claude login
```

## 🚨 注意事项

- **完全权限模式**：使用 `bypassPermissions` 时请确保在安全环境中操作
- **文件备份**：重要文件请提前备份
- **网络要求**：需要稳定的网络连接访问 Claude API

## 📄 许可证

ISC License

## 🤝 贡献

欢迎提交 Issue 和 Pull Request 来改进这个项目。

---

**Powered by Claude Code SDK** | **Built with Next.js & TypeScript**