import { query, type Query, type SDKUserMessage, type SDKMessage, Options } from "@anthropic-ai/claude-code";
import { AsyncQueue } from './async-queue';

type MessageHandler = (msg: SDKMessage) => void | Promise<void>;

// 静态方法，用于直接执行任务
export async function* runTask(prompt: string, options: Options): AsyncIterable<SDKMessage> {
  const queue = new AsyncQueue<SDKUserMessage>();

  // 创建初始消息
  queue.enqueue({
    type: "user",
    message: {
      "role": "user",
      "content": prompt
    },
    parent_tool_use_id: null,
    session_id: ''
  });

  // 执行查询
  const q = query({
    prompt: queue,
    options: options
  });

  // 返回消息流
  for await (const msg of q) {
    yield msg;
  }
}

export class ClaudeCodeSdk {
  private messageHandlers: Set<MessageHandler> = new Set();
  private allMessages: SDKMessage[] = [];

  constructor(defaultOptions: Partial<Options>) {
    const ops: Options = {
    ...{
        maxTurns: 100,
        allowedTools: ["Read", "Grep"],
        canUseTool: async (toolName, input) => {
          console.log('canUseTool11: ', toolName, input);
          return {
            behavior: "allow",
            updatedInput: input
          };
        }
      },
      ...defaultOptions,
    }
    this.query = query({
      prompt: this.queue,
      options: ops
    });
    if (defaultOptions.resume && defaultOptions.continue) {
      this.session_id = defaultOptions.resume;
    }
    this._setupMessages();
  }
  private queue: AsyncQueue<SDKUserMessage> = new AsyncQueue<SDKUserMessage>();
  private query: Query;
  private session_id = '';

  private async _setupMessages() {
    for await (const msg of this.query) {
      if (msg.type == 'system' && msg.subtype == 'init') {
        this.session_id = msg.session_id;
      }
      // 保存消息
      this.allMessages.push(msg);
      // 触发所有注册的消息处理器
      for (const handler of this.messageHandlers) {
        try {
          await handler(msg);
        } catch (error) {
          console.error('Message handler error:', error);
        }
      }
    }
  }

  // 获取消息流的异步迭代器
  async *getMessageStream(): AsyncIterable<SDKMessage> {
    for await (const msg of this.query) {
      yield msg;
    }
  }

  // 获取当前会话ID
  getSessionId(): string {
    return this.session_id;
  }

  // 获取所有消息
  getAllMessages(): SDKMessage[] {
    return [...this.allMessages];
  }

  // 添加消息监听器
  onMessage(handler: MessageHandler): () => void {
    this.messageHandlers.add(handler);
    // 返回取消监听的函数
    return () => {
      this.messageHandlers.delete(handler);
    };
  }

  sendTextMessage(message: string) {
    this.queue.enqueue({
      type: "user",
      message: {
        "role": "user",
        "content": message
      },
      parent_tool_use_id: null,
      session_id: this.session_id
    });
  }
}
