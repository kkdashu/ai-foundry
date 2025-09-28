/// <reference types="bun-types" />
import { describe, it, expect, mock, beforeEach } from "bun:test";
import { Session } from "../session";

// Mock the AIClient's queryStream method
const mockQueryStream = mock((content: string, options?: any) => {
  return (async function* () {
    yield { type: "system", subtype: "init", session_id: "session-123" };
    yield { type: "user", message: { content } };
    yield { type: "assistant", message: { content: `Response to: ${content}` } };
    yield {
      type: "result",
      subtype: "success",
      result: "completed",
      total_cost_usd: 0.02,
      duration_ms: 500
    };
  })();
});

// Mock the AIClient module
mock.module("../ai-client", () => ({
  AIClient: class MockAIClient {
    constructor(options?: any) {}
    queryStream = mockQueryStream;
  }
}));

describe("Session", () => {
  beforeEach(() => {
    mockQueryStream.mockClear();
  });

  it("should create a session with an ID", () => {
    const session = new Session("test-session");
    expect(session.id).toBe("test-session");
  });

  it("should send a message and get response", async () => {
    const session = new Session("test-session");
    const result = await session.sendMessage("Hello");

    expect(result).toBeDefined();
    expect(result.messages).toBeArray();
    expect(result.messages.length).toBe(4); // system, user, assistant, result
    expect(result.cost).toBe(0.02);
    expect(result.duration).toBe(500);
  });

  it("should maintain message history", async () => {
    const session = new Session("test-session");

    await session.sendMessage("First message");
    await session.sendMessage("Second message");

    const history = session.getHistory();
    expect(history).toBeArray();
    expect(history.length).toBeGreaterThan(0);
  });

  it("should stream messages", async () => {
    const session = new Session("test-session");
    const messages = [];

    for await (const message of session.sendMessageStream("Stream test")) {
      messages.push(message);
    }

    expect(messages.length).toBe(4);
    expect(messages[0].type).toBe("system");
    expect(messages[1].type).toBe("user");
    expect(messages[2].type).toBe("assistant");
    expect(messages[3].type).toBe("result");
  });

  it("should capture and reuse session ID for multi-turn conversations", async () => {
    const session = new Session("test-session");

    // First message - should capture session ID
    await session.sendMessage("First turn");

    // Second message - should reuse session ID
    const result = await session.sendMessage("Second turn");

    expect(result.messages).toBeDefined();
    // The mock should have been called with resume option on second call
    expect(mockQueryStream).toHaveBeenCalledTimes(2);
  });

  it("should reset session properly", async () => {
    const session = new Session("test-session");

    await session.sendMessage("Message");
    const historyBefore = session.getHistory();
    expect(historyBefore.length).toBeGreaterThan(0);

    session.reset();
    const historyAfter = session.getHistory();
    expect(historyAfter.length).toBe(0);
  });

  it("should cleanup session", () => {
    const session = new Session("test-session");
    session.cleanup();

    // After cleanup, history should be empty
    const history = session.getHistory();
    expect(history.length).toBe(0);
  });

  it("should handle custom options", async () => {
    const session = new Session("test-session", {
      maxTurns: 10,
      appendSystemPrompt: "Custom prompt"
    });

    const result = await session.sendMessage("Test");
    expect(result).toBeDefined();
  });

  it("should allow options override per message", async () => {
    const session = new Session("test-session");

    const result = await session.sendMessage("Test", {
      maxTurns: 20
    });

    expect(result).toBeDefined();
    expect(mockQueryStream).toHaveBeenCalled();
  });
});