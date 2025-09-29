import { logMessage } from "./cc-message-log";
import { ClaudeCodeSdk } from "./sdk";

async function main() {
  const sdk = new ClaudeCodeSdk({
    canUseTool: async (toolName, input) => {
      console.log(toolName, input);
      return {
        behavior: "allow",
        updatedInput: input,
        // message: '',
        // interrupt: true,
      };
    }
  });
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
