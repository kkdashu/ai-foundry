/// <reference types="bun-types" />
import { describe, it, expect, mock, beforeEach } from "bun:test";
import { StreamSession } from "../stream-session";
import { AsyncQueue } from "../async-queue";

// Mock the AIClient's queryStream to return test messages
const createMockStream = () => {
  return (async function* () {
    yield { type: "system", subtype: "init", session_id: "test-session-123" };
    yield { type: "user", message: { role: "user", content: "Test message" } };
    yield { type: "assistant", message: { role: "assistant", content: "Test response" } };
    yield { type: "result", subtype: "success", total_cost_usd: 0.01, duration_ms: 100 };
  })();
};

// Mock AIClient
mock.module("../ai-client", () => ({
  AIClient: class MockAIClient {
    constructor(options?: any) {}
    queryStream = mock(() => createMockStream());
  }
}));

describe("StreamSession", () => {
  describe("Basic functionality", () => {
    it("should create a session with an ID", () => {
      const session = new StreamSession("test-session");
      expect(session.id).toBe("test-session");
      expect(session.isActive()).toBe(true);
    });

    it("should send text messages", async () => {
      const session = new StreamSession("test-session");

      // Should not throw
      await expect(session.sendText("Hello")).resolves.toBeUndefined();
    });

    it("should send SDKUserMessages", async () => {
      const session = new StreamSession("test-session");

      const message = {
        type: "user" as const,
        message: {
          role: "user" as const,
          content: "Test content"
        }
      };

      await expect(session.send(message)).resolves.toBeUndefined();
    });

    it("should handle session closure", () => {
      const session = new StreamSession("test-session");
      expect(session.isActive()).toBe(true);

      session.close();
      expect(session.isActive()).toBe(false);

      // Should throw when trying to send after close
      expect(session.sendText("Hello")).rejects.toThrow("Session is closed");
    });
  });

  describe("Image handling", () => {
    it("should send messages with images", async () => {
      const session = new StreamSession("test-session");

      const imageData = "base64encodedimage";
      await expect(
        session.sendWithImage("Analyze this", imageData, "image/png")
      ).resolves.toBeUndefined();
    });

    it("should detect MIME types correctly", async () => {
      const session = new StreamSession("test-session");

      // Test internal method indirectly through sendWithImageFile
      // Note: This would need fs mocking in a real scenario
      const getMimeType = (session as any).getMimeType.bind(session);

      expect(getMimeType("image.jpg")).toBe("image/jpeg");
      expect(getMimeType("image.png")).toBe("image/png");
      expect(getMimeType("image.gif")).toBe("image/gif");
      expect(getMimeType("image.webp")).toBe("image/webp");
      expect(getMimeType("image.unknown")).toBe("image/png"); // default
    });
  });

  describe("Batch operations", () => {
    it("should send multiple messages in batch", async () => {
      const session = new StreamSession("test-session");

      const messages = [
        "First message",
        {
          type: "user" as const,
          message: {
            role: "user" as const,
            content: "Second message"
          }
        },
        "Third message"
      ];

      await expect(session.sendBatch(messages)).resolves.toBeUndefined();
    });
  });

  describe("History tracking", () => {
    it("should start with empty history", () => {
      const session = new StreamSession("test-session");
      expect(session.getHistory()).toEqual([]);
    });

    it("should track session ID", () => {
      const session = new StreamSession("test-session");
      expect(session.getSessionId()).toBeNull();
    });
  });
});

describe("AsyncQueue", () => {
  it("should enqueue and dequeue items in order", async () => {
    const queue = new AsyncQueue<number>();

    await queue.enqueue(1);
    await queue.enqueue(2);
    await queue.enqueue(3);

    expect(await queue.dequeue()).toBe(1);
    expect(await queue.dequeue()).toBe(2);
    expect(await queue.dequeue()).toBe(3);
  });

  it("should handle async iteration", async () => {
    const queue = new AsyncQueue<string>();

    await queue.enqueue("a");
    await queue.enqueue("b");
    await queue.enqueue("c");
    queue.close();

    const items: string[] = [];
    for await (const item of queue) {
      items.push(item);
    }

    expect(items).toEqual(["a", "b", "c"]);
  });

  it("should wait for items when queue is empty", async () => {
    const queue = new AsyncQueue<string>();

    // Start dequeue before enqueue
    const dequeuePromise = queue.dequeue();

    // Enqueue after a delay
    setTimeout(() => queue.enqueue("delayed"), 10);

    const result = await dequeuePromise;
    expect(result).toBe("delayed");
  });

  it("should return null when closed and empty", async () => {
    const queue = new AsyncQueue<number>();
    queue.close();

    const result = await queue.dequeue();
    expect(result).toBeNull();
  });

  it("should throw when enqueueing to closed queue", async () => {
    const queue = new AsyncQueue<number>();
    queue.close();

    await expect(queue.enqueue(1)).rejects.toThrow("Cannot enqueue to a closed queue");
  });

  it("should report correct size and status", async () => {
    const queue = new AsyncQueue<number>();

    expect(queue.isEmpty()).toBe(true);
    expect(queue.size()).toBe(0);
    expect(queue.isClosed()).toBe(false);

    await queue.enqueue(1);
    await queue.enqueue(2);

    expect(queue.isEmpty()).toBe(false);
    expect(queue.size()).toBe(2);

    queue.close();
    expect(queue.isClosed()).toBe(true);
  });

  it("should clear all items", async () => {
    const queue = new AsyncQueue<number>();

    await queue.enqueue(1);
    await queue.enqueue(2);
    await queue.enqueue(3);

    expect(queue.size()).toBe(3);

    queue.clear();
    expect(queue.size()).toBe(0);
    expect(queue.isEmpty()).toBe(true);
  });

  it("should track waiting consumers", async () => {
    const queue = new AsyncQueue<string>();

    expect(queue.waitingConsumers()).toBe(0);

    // Create waiting consumers
    const promise1 = queue.dequeue();
    const promise2 = queue.dequeue();

    expect(queue.waitingConsumers()).toBe(2);

    // Satisfy one consumer
    await queue.enqueue("item1");
    await promise1;

    expect(queue.waitingConsumers()).toBe(1);

    // Close queue to release remaining consumers
    queue.close();
    await promise2;

    expect(queue.waitingConsumers()).toBe(0);
  });
});