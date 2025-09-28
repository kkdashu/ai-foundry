/// <reference types="bun-types" />
import { describe, it, expect, mock } from "bun:test";
import { createCustomServer, exampleTool, type CustomTool } from "../custom-tools";
import { z } from "zod";

// Mock the claude-code module
mock.module("@anthropic-ai/claude-code", () => ({
  tool: mock((name: string, description: string, schema: any, handler: any) => ({
    name,
    description,
    schema,
    handler
  })),
  createSdkMcpServer: mock((config: any) => ({
    ...config,
    _type: "mcp_server"
  }))
}));

describe("custom-tools", () => {
  describe("createCustomServer", () => {
    it("should create a custom MCP server", () => {
      const tools: CustomTool[] = [
        {
          name: "test_tool",
          description: "A test tool",
          schema: { input: z.string() },
          handler: async (args) => ({ content: [{ type: "text", text: "test" }] })
        }
      ];

      const server = createCustomServer("test-server", "1.0.0", tools);

      expect(server).toBeDefined();
      expect(server.name).toBe("test-server");
      expect(server.version).toBe("1.0.0");
      expect(server._type).toBe("mcp_server");
    });

    it("should handle multiple tools", () => {
      const tools: CustomTool[] = [
        {
          name: "tool1",
          description: "First tool",
          schema: { param1: z.string() },
          handler: async (args) => ({ content: [{ type: "text", text: args.param1 }] })
        },
        {
          name: "tool2",
          description: "Second tool",
          schema: { param2: z.number() },
          handler: async (args) => ({ content: [{ type: "text", text: args.param2.toString() }] })
        }
      ];

      const server = createCustomServer("multi-tool-server", "2.0.0", tools);

      expect(server).toBeDefined();
      expect(server.tools).toBeArray();
      expect(server.tools.length).toBe(2);
    });

    it("should handle empty tools array", () => {
      const server = createCustomServer("empty-server", "1.0.0", []);

      expect(server).toBeDefined();
      expect(server.tools).toBeArray();
      expect(server.tools.length).toBe(0);
    });
  });

  describe("exampleTool", () => {
    it("should have correct structure", () => {
      expect(exampleTool.name).toBe("example_tool");
      expect(exampleTool.description).toBe("An example custom tool");
      expect(exampleTool.schema).toBeDefined();
      expect(exampleTool.handler).toBeFunction();
    });

    it("should handle input correctly", async () => {
      const result = await exampleTool.handler({ input: "test input" });

      expect(result).toBeDefined();
      expect(result.content).toBeArray();
      expect(result.content[0].type).toBe("text");
      expect(result.content[0].text).toBe("Received input: test input");
    });

    it("should work with createCustomServer", () => {
      const server = createCustomServer("example-server", "1.0.0", [exampleTool]);

      expect(server).toBeDefined();
      expect(server.tools).toBeArray();
      expect(server.tools[0].name).toBe("example_tool");
    });
  });

  describe("CustomTool type", () => {
    it("should create valid custom tools", () => {
      const customTool: CustomTool = {
        name: "custom_test",
        description: "Custom test tool",
        schema: {
          text: z.string().describe("Input text"),
          count: z.number().optional().describe("Optional count")
        },
        handler: async (args) => {
          const { text, count } = args;
          const repeated = count ? text.repeat(count) : text;
          return {
            content: [{
              type: "text",
              text: repeated
            }]
          };
        }
      };

      expect(customTool.name).toBe("custom_test");
      expect(customTool.handler).toBeFunction();
    });

    it("should handle complex schemas", () => {
      const complexTool: CustomTool = {
        name: "complex_tool",
        description: "Tool with complex schema",
        schema: {
          user: z.object({
            name: z.string(),
            age: z.number(),
            email: z.string().email()
          }),
          options: z.array(z.string()),
          enabled: z.boolean()
        },
        handler: async (args) => {
          return {
            content: [{
              type: "text",
              text: JSON.stringify(args, null, 2)
            }]
          };
        }
      };

      expect(complexTool.schema).toBeDefined();
      expect(complexTool.schema.user).toBeDefined();
      expect(complexTool.schema.options).toBeDefined();
      expect(complexTool.schema.enabled).toBeDefined();
    });
  });

  describe("Integration", () => {
    it("should create a functional tool pipeline", async () => {
      const pipeTool: CustomTool = {
        name: "pipe_tool",
        description: "Pipes input through transformations",
        schema: {
          input: z.string(),
          uppercase: z.boolean().optional(),
          reverse: z.boolean().optional()
        },
        handler: async ({ input, uppercase, reverse }) => {
          let result = input;
          if (uppercase) result = result.toUpperCase();
          if (reverse) result = result.split("").reverse().join("");
          return {
            content: [{
              type: "text",
              text: result
            }]
          };
        }
      };

      // Test the handler
      const result1 = await pipeTool.handler({ input: "hello", uppercase: true });
      expect(result1.content[0].text).toBe("HELLO");

      const result2 = await pipeTool.handler({ input: "hello", reverse: true });
      expect(result2.content[0].text).toBe("olleh");

      const result3 = await pipeTool.handler({
        input: "hello",
        uppercase: true,
        reverse: true
      });
      expect(result3.content[0].text).toBe("OLLEH");
    });
  });
});