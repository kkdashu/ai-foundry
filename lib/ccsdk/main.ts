import { Options } from "@anthropic-ai/claude-code";
import { logMessage } from "./cc-message-log";
import { ClaudeCodeSdk } from "./sdk";
import { homedir } from "os";
import { resolve } from "path";

function parseArgs(): { cwd?: string } {
  const args = process.argv.slice(2);
  const options: { cwd?: string } = {};

  for (const arg of args) {
    if (arg.startsWith("--cwd=")) {
      const cwdPath = arg.slice(6);
      // 处理 ~ 开头的路径
      if (cwdPath.startsWith("~")) {
        options.cwd = resolve(homedir(), cwdPath.slice(2));
      } else {
        options.cwd = resolve(cwdPath);
      }
    }
  }

  return options;
}

async function main() {
  const args = parseArgs();

  const sdkOptions: Options = {
    canUseTool: async (toolName, input) => {
      console.log(toolName, input);
      return {
        behavior: "allow",
        updatedInput: input,
      };
    }
  };

  // 如果提供了 cwd 参数，添加到选项中
  if (args.cwd) {
    sdkOptions.cwd = args.cwd;
    console.log(`🗂️  Working directory set to: ${args.cwd}`);
  }

  const sdk = new ClaudeCodeSdk(sdkOptions);
  console.log("💬 [Input] Ready for input. Type your messages and press Enter:");

  sdk.onMessage((message) => {
    logMessage(message);
  });
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', (data) => {
    const input = data.toString().trim();
    if (input) {
      console.log(`📝 [Input] Received: ${input}`);
      sdk.sendTextMessage(input);
    }
  });
}
main();
