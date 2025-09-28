import { AIClient, AIQueryOptions } from "./ai-client";
import { MessageQueue } from "./message-queue";
import type { SDKMessage, SDKUserMessage } from "./types";

export class Session {
  public readonly id: string;
  private aiClient: AIClient;
  private sdkSessionId: string | null = null;
  private messageHistory: SDKMessage[] = [];
  private messageQueue: MessageQueue<SDKUserMessage>;

  constructor(id: string, options?: Partial<AIQueryOptions>) {
    this.id = id;
    this.aiClient = new AIClient(options);
    this.messageQueue = new MessageQueue();
  }

  async sendMessage(content: string, options?: Partial<AIQueryOptions>): Promise<{
    messages: SDKMessage[];
    cost: number;
    duration: number;
  }> {
    const mergedOptions = this.sdkSessionId
      ? { ...options, resume: this.sdkSessionId }
      : options;

    const messages: SDKMessage[] = [];
    let totalCost = 0;
    let duration = 0;

    for await (const message of this.aiClient.queryStream(content, mergedOptions)) {
      messages.push(message);
      this.messageHistory.push(message);

      if (message.type === 'system' && message.subtype === 'init') {
        this.sdkSessionId = message.session_id;
      }

      if (message.type === "result" && message.subtype === "success") {
        totalCost = message.total_cost_usd;
        duration = message.duration_ms;
      }
    }

    return { messages, cost: totalCost, duration };
  }

  async *sendMessageStream(
    content: string,
    options?: Partial<AIQueryOptions>
  ): AsyncIterable<SDKMessage> {
    const mergedOptions = this.sdkSessionId
      ? { ...options, resume: this.sdkSessionId }
      : options;

    for await (const message of this.aiClient.queryStream(content, mergedOptions)) {
      this.messageHistory.push(message);

      if (message.type === 'system' && message.subtype === 'init') {
        this.sdkSessionId = message.session_id;
      }

      yield message;
    }
  }

  getHistory(): SDKMessage[] {
    return [...this.messageHistory];
  }

  reset(): void {
    this.sdkSessionId = null;
    this.messageHistory = [];
  }

  cleanup(): void {
    this.messageQueue.close();
    this.reset();
  }
}