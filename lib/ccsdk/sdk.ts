import { query, type Query, type SDKUserMessage, type SDKMessage, Options } from "@anthropic-ai/claude-code"; // 假设的导入
import { AsyncQueue } from './async-queue';

type MessageHandler = (msg: SDKMessage) => void | Promise<void>;

export class ClaudeCodeSdk {
  private messageHandlers: Set<MessageHandler> = new Set();

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
