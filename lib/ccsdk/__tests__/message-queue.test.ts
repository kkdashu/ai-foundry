/// <reference types="bun-types" />
import { describe, it, expect } from "bun:test";
import { MessageQueue } from "../message-queue";

describe("MessageQueue", () => {
  it("should create a new message queue", () => {
    const queue = new MessageQueue<string>();
    expect(queue).toBeDefined();
    expect(queue.isClosed()).toBe(false);
  });

  it("should push and retrieve messages in order", async () => {
    const queue = new MessageQueue<string>();

    await queue.push("message1");
    await queue.push("message2");
    await queue.push("message3");

    const result1 = await queue.next();
    expect(result1.done).toBe(false);
    expect(result1.value).toBe("message1");

    const result2 = await queue.next();
    expect(result2.done).toBe(false);
    expect(result2.value).toBe("message2");

    const result3 = await queue.next();
    expect(result3.done).toBe(false);
    expect(result3.value).toBe("message3");
  });

  it("should handle async push and next operations", async () => {
    const queue = new MessageQueue<number>();

    // Push messages asynchronously
    setTimeout(() => queue.push(1), 10);
    setTimeout(() => queue.push(2), 20);
    setTimeout(() => queue.push(3), 30);

    const results: number[] = [];
    for (let i = 0; i < 3; i++) {
      const result = await queue.next();
      if (!result.done) {
        results.push(result.value);
      }
    }

    expect(results).toEqual([1, 2, 3]);
  });

  it("should close the queue properly", async () => {
    const queue = new MessageQueue<string>();

    await queue.push("message1");
    queue.close();

    expect(queue.isClosed()).toBe(true);

    // Should throw when pushing to closed queue
    await expect(queue.push("message2")).rejects.toThrow("Queue is closed");

    // Should still be able to read existing messages
    const result1 = await queue.next();
    expect(result1.done).toBe(false);
    expect(result1.value).toBe("message1");

    // Should return done after queue is empty and closed
    const result2 = await queue.next();
    expect(result2.done).toBe(true);
  });

  it("should handle multiple types", async () => {
    interface TestMessage {
      id: number;
      content: string;
    }

    const queue = new MessageQueue<TestMessage>();

    const msg1: TestMessage = { id: 1, content: "first" };
    const msg2: TestMessage = { id: 2, content: "second" };

    await queue.push(msg1);
    await queue.push(msg2);

    const result1 = await queue.next();
    expect(result1.done).toBe(false);
    expect(result1.value).toEqual(msg1);

    const result2 = await queue.next();
    expect(result2.done).toBe(false);
    expect(result2.value).toEqual(msg2);
  });
});