# CCSDK - Claude Code SDK

CCSDK 是一个用于与 Claude Code API 交互的 TypeScript SDK，提供了简单的接口来发送消息和接收响应。

## 功能特性

- 异步消息队列处理
- 消息监听和事件处理
- 支持命令行参数配置
- 完整的消息日志记录
- 支持自定义工作目录

## 安装

```bash
bun install @anthropic-ai/claude-code
```

## 使用方法

### 基础用法

```typescript
import { ClaudeCodeSdk } from './sdk';

// 创建 SDK 实例
const sdk = new ClaudeCodeSdk({
  maxTurns: 100,
  allowedTools: ["Read", "Grep"],
  canUseTool: async (toolName, input) => {
    console.log('Tool usage:', toolName, input);
    return {
      behavior: "allow",
      updatedInput: input
    };
  }
});

// 添加消息监听器
sdk.onMessage((message) => {
  console.log('收到消息:', message);
});

// 发送文本消息
sdk.sendTextMessage('Hello, Claude!');
```

### 命令行使用

```bash
# 运行主程序
bun run lib/ccsdk/main.ts

# 指定工作目录
bun run lib/ccsdk/main.ts --cwd=/path/to/directory

# 使用 ~ 路径
bun run lib/ccsdk/main.ts --cwd=~/projects/myapp
```

### 消息处理

SDK 支持多种消息类型：

- `user`: 用户发送的消息
- `assistant`: Claude 的回复
- `result`: 工具执行结果
- `system`: 系统消息（如会话初始化）
- `stream_event`: 流式响应事件

```typescript
sdk.onMessage((msg: SDKMessage) => {
  switch (msg.type) {
    case 'user':
      console.log('用户消息:', msg.message);
      break;
    case 'assistant':
      console.log('助手回复:', msg.message.content);
      break;
    case 'result':
      console.log('执行结果:', msg.subtype, msg.is_error);
      break;
    case 'system':
      if (msg.subtype === 'init') {
        console.log('会话初始化:', msg.session_id);
      }
      break;
  }
});
```

### 取消监听

```typescript
// onMessage 返回一个取消函数
const unsubscribe = sdk.onMessage((msg) => {
  // 处理消息
});

// 稍后取消监听
unsubscribe();
```

## API 参考

### ClaudeCodeSdk

#### 构造函数

```typescript
new ClaudeCodeSdk(options?: Partial<Options>)
```

**参数：**
- `options`: 配置选项
  - `maxTurns`: 最大对话轮次（默认：100）
  - `allowedTools`: 允许使用的工具列表
  - `canUseTool`: 工具使用权限检查函数
  - `cwd`: 工作目录路径
  - `resume`: 恢复会话 ID
  - `continue`: 是否继续之前的会话

#### 方法

##### onMessage

监听消息事件。

```typescript
onMessage(handler: (msg: SDKMessage) => void | Promise<void>): () => void
```

**返回：** 取消监听的函数

##### sendTextMessage

发送文本消息给 Claude。

```typescript
sendTextMessage(message: string): void
```

## 文件结构

```
lib/ccsdk/
├── README.md         # 本文档
├── main.ts          # 命令行入口
├── sdk.ts           # SDK 核心实现
├── async-queue.ts   # 异步队列实现
├── cc-message-log.ts # 消息日志工具
├── test-example.ts  # 使用示例
└── ccsdk.ts         # 模块导出（空文件）
```

## 示例

查看 `test-example.ts` 了解完整的使用示例。

## 依赖

- `@anthropic-ai/claude-code`: Claude Code 官方 SDK
- Node.js 内置模块：`os`, `path`

## 许可证

请参考项目根目录的许可证文件。