import { tool, createSdkMcpServer } from "@anthropic-ai/claude-code";
import { z } from "zod";

export interface CustomTool {
  name: string;
  description: string;
  schema: any;
  handler: (args: any) => Promise<any>;
}

export function createCustomServer(name: string, version: string, tools: CustomTool[]) {
  const mcpTools = tools.map(t =>
    tool(
      t.name,
      t.description,
      t.schema,
      t.handler
    )
  );

  return createSdkMcpServer({
    name,
    version,
    tools: mcpTools
  });
}

export const exampleTool: CustomTool = {
  name: "example_tool",
  description: "An example custom tool",
  schema: {
    input: z.string().describe("Input parameter")
  },
  handler: async (args) => {
    return {
      content: [{
        type: "text",
        text: `Received input: ${args.input}`
      }]
    };
  }
};