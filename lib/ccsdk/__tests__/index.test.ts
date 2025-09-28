/// <reference types="bun-types" />
import { describe, it, expect } from "bun:test";
import * as SDK from "../index";

describe("SDK exports", () => {
  it("should export AIClient", () => {
    expect(SDK.AIClient).toBeDefined();
  });

  it("should export Session", () => {
    expect(SDK.Session).toBeDefined();
  });

  it("should export MessageQueue", () => {
    expect(SDK.MessageQueue).toBeDefined();
  });

  it("should export createCustomServer", () => {
    expect(SDK.createCustomServer).toBeDefined();
    expect(SDK.createCustomServer).toBeFunction();
  });

  it("should export exampleTool", () => {
    expect(SDK.exampleTool).toBeDefined();
    expect(SDK.exampleTool.name).toBe("example_tool");
  });

  it("should export query from claude-code", () => {
    expect(SDK.query).toBeDefined();
    expect(SDK.query).toBeFunction();
  });

  it("should export types", () => {
    // Type exports can't be tested directly at runtime
    // But we can test that the module loads without errors
    const typeTest = (): SDK.SDKMessage => ({
      type: "system",
      subtype: "init",
      session_id: "test"
    } as any);

    const message = typeTest();
    expect(message.type).toBe("system");
  });

  it("should allow creating instances", () => {
    const client = new SDK.AIClient();
    expect(client).toBeDefined();

    const session = new SDK.Session("test-session");
    expect(session).toBeDefined();
    expect(session.id).toBe("test-session");

    const queue = new SDK.MessageQueue<string>();
    expect(queue).toBeDefined();
    expect(queue.isClosed()).toBe(false);
  });
});