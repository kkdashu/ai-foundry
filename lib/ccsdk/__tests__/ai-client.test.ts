/// <reference types="bun-types" />
import { describe, it, expect, mock } from "bun:test";
import { AIClient } from "../ai-client";
import * as claudeCode from "@anthropic-ai/claude-code";

// Mock the claude-code module
mock.module("@anthropic-ai/claude-code", () => ({
  query: mock(() => {
    // Return an async generator for testing
    return (async function* () {
      yield { type: "system", subtype: "init", session_id: "test-session-123" };
      yield { type: "user", message: { content: "test query" } };
      yield { type: "assistant", message: { content: "test response" } };
      yield {
        type: "result",
        subtype: "success",
        result: "completed",
        total_cost_usd: 0.01,
        duration_ms: 1000
      };
    })();
  })
}));

describe("AIClient", () => {
  it("should create an AIClient with default options", () => {
    const client = new AIClient();
    expect(client).toBeDefined();
  });

  it("should create an AIClient with custom options", () => {
    const client = new AIClient({
      maxTurns: 10,
      appendSystemPrompt: "Custom prompt",
      cwd: "/custom/path"
    });
    expect(client).toBeDefined();
  });

  it("should execute querySingle and return messages", async () => {
    const client = new AIClient();
    const result = await client.querySingle("test query");

    expect(result).toBeDefined();
    expect(result.messages).toBeArray();
    expect(result.messages.length).toBeGreaterThan(0);
    expect(result.cost).toBe(0.01);
    expect(result.duration).toBe(1000);
  });

  it("should stream messages with queryStream", async () => {
    const client = new AIClient();
    const messages = [];

    for await (const message of client.queryStream("test query")) {
      messages.push(message);
    }

    expect(messages.length).toBeGreaterThan(0);
    expect(messages[0].type).toBe("system");
    expect(messages[0].subtype).toBe("init");
  });

  it("should handle hooks configuration", () => {
    const customHook = async (input: any) => ({ continue: true });

    const client = new AIClient({
      hooks: {
        PreToolUse: [{
          matcher: "Write",
          hooks: [customHook]
        }]
      }
    });

    expect(client).toBeDefined();
  });

  it("should handle MCP server configuration", () => {
    const client = new AIClient({
      mcpServers: {
        testServer: { name: "test", version: "1.0.0" }
      }
    });

    expect(client).toBeDefined();
  });

  it("should merge options correctly", async () => {
    const client = new AIClient({
      maxTurns: 5,
      appendSystemPrompt: "Default prompt"
    });

    const result = await client.querySingle("test", {
      maxTurns: 10 // Override default
    });

    expect(result).toBeDefined();
    expect(result.messages).toBeArray();
  });

  it("should handle async iterable input", async () => {
    const client = new AIClient();

    async function* createMessages() {
      yield { type: "user" as const, message: { content: "message 1" } };
      yield { type: "user" as const, message: { content: "message 2" } };
    }

    const messages = [];
    for await (const message of client.queryStream(createMessages())) {
      messages.push(message);
    }

    expect(messages.length).toBeGreaterThan(0);
  });
});