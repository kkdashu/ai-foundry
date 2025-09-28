import { AIClient, AIQueryOptions } from "./ai-client";
import { AsyncQueue } from "./async-queue";
import type { SDKMessage, SDKUserMessage } from "./types";
import * as fs from "fs";

/**
 * StreamSession - A true streaming session implementation
 *
 * This class maintains a single persistent connection to the Claude API
 * and allows sending messages asynchronously while receiving responses
 * through a separate subscription mechanism.
 */
export class StreamSession {
  public readonly id: string;
  private aiClient: AIClient;
  private messageQueue: AsyncQueue<SDKUserMessage>;
  private responseStream: AsyncIterable<SDKMessage> | null = null;
  private sessionId: string | null = null;
  private messageHistory: SDKMessage[] = [];
  private isInitialized = false;
  private isClosed = false;
  private streamPromise: Promise<void> | null = null;

  constructor(id: string, options?: Partial<AIQueryOptions>) {
    this.id = id;
    this.aiClient = new AIClient(options);
    this.messageQueue = new AsyncQueue<SDKUserMessage>();
    this.initializeStream(options);
  }

  /**
   * Initialize the streaming connection
   * This creates a single persistent query that will handle all messages
   */
  private initializeStream(options?: Partial<AIQueryOptions>): void {
    // Create an async generator that pulls from our message queue
    const messageGenerator = async function* (queue: AsyncQueue<SDKUserMessage>) {
      for await (const message of queue) {
        console.log('message: ', message);
        yield message;
      }
    };

    // Start the stream with our message generator
    this.responseStream = this.aiClient.queryStream(
      messageGenerator(this.messageQueue),
      options
    );

    this.isInitialized = true;
  }

  /**
   * Send a complete SDKUserMessage
   * This is the core method - all other send methods use this
   */
  async send(message: SDKUserMessage): Promise<void> {
    if (this.isClosed) {
      throw new Error("Session is closed");
    }

    if (!this.isInitialized) {
      throw new Error("Session not initialized");
    }

    await this.messageQueue.enqueue(message);
  }

  /**
   * Convenience method: Send a text message
   */
  async sendText(content: string): Promise<void> {
    await this.send({
      type: "user",
      message: {
        role: "user",
        content
      },
      parent_tool_use_id: null,
      session_id: this.sessionId || ''
    });
  }

  /**
   * Send a message with an image
   * @param text The text content
   * @param imageData Base64 encoded image data
   * @param mimeType The MIME type of the image (default: image/png)
   */
  async sendWithImage(
    text: string,
    imageData: string,
    mimeType: string = "image/png"
  ): Promise<void> {
    await this.send({
      type: "user",
      message: {
        role: "user",
        content: [
          { type: "text", text },
          {
            type: "image",
            source: {
              type: "base64",
              media_type: mimeType as any,
              data: imageData
            }
          }
        ]
      },
      parent_tool_use_id: null,
      session_id: this.sessionId || ''
    });
  }

  /**
   * Send a message with an image file
   * @param text The text content
   * @param filePath Path to the image file
   */
  async sendWithImageFile(text: string, filePath: string): Promise<void> {
    const imageData = fs.readFileSync(filePath, "base64");
    const mimeType = this.getMimeType(filePath);
    await this.sendWithImage(text, imageData, mimeType);
  }

  /**
   * Subscribe to all messages from the stream
   */
  async *subscribe(): AsyncIterable<SDKMessage> {
    if (!this.responseStream) {
      throw new Error("Response stream not initialized");
    }

    for await (const message of this.responseStream) {
      console.log('msg: ', message);
      // Store message in history
      this.messageHistory.push(message);

      // Capture session ID if available
      if (message.type === "system" && message.subtype === "init") {
        this.sessionId = message.session_id;
      }

      yield message;

      // Check if session ended
      if (message.type === "result") {
        if (message.subtype !== "success") {
          console.error("Session ended with error:", message.subtype);
        }
        break;
      }
    }
  }

  /**
   * Get the current session ID
   */
  getSessionId(): string | null {
    return this.sessionId;
  }

  /**
   * Get message history
   */
  getHistory(): SDKMessage[] {
    return [...this.messageHistory];
  }

  /**
   * Check if session is active
   */
  isActive(): boolean {
    return this.isInitialized && !this.isClosed;
  }

  /**
   * Close the session
   */
  close(): void {
    this.isClosed = true;
    this.messageQueue.close();
  }

  /**
   * Helper to determine MIME type from file extension
   */
  private getMimeType(filePath: string): string {
    const ext = filePath.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'jpg':
      case 'jpeg':
        return 'image/jpeg';
      case 'png':
        return 'image/png';
      case 'gif':
        return 'image/gif';
      case 'webp':
        return 'image/webp';
      case 'svg':
        return 'image/svg+xml';
      default:
        return 'image/png';
    }
  }

  /**
   * Send multiple messages in sequence
   */
  async sendBatch(messages: Array<string | SDKUserMessage>): Promise<void> {
    for (const msg of messages) {
      if (typeof msg === "string") {
        await this.sendText(msg);
      } else {
        await this.send(msg);
      }
    }
  }
}
