#!/usr/bin/env bun
/**
 * Main test file for StreamSession
 * Run with: bun run lib/ccsdk/main.ts
 */

import { StreamSession } from "./stream-session";
import type { SDKMessage } from "./types";

// Color codes for terminal output
const colors = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  dim: "\x1b[2m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
  white: "\x1b[37m"
};

function log(prefix: string, message: string, color: string = colors.white) {
  console.log(`${color}${prefix}${colors.reset} ${message}`);
}

async function main() {
  console.log(`\n${colors.bright}🚀 StreamSession Test - True Streaming Architecture${colors.reset}\n`);
  console.log(`${colors.dim}This demonstrates a single persistent connection with async message sending${colors.reset}\n`);

  // Create session with options
  const session = new StreamSession("test-session-001", {
    maxTurns: 10,
    // permissionMode: 'plan',  // Remove plan mode to allow multiple turns
    appendSystemPrompt: "You are a helpful assistant. Keep responses concise."
  });

  log("✅", `Session created: ${session.id}`, colors.green);
  log("📊", `Session active: ${session.isActive()}`, colors.cyan);

  // Track statistics
  let messageCount = 0;
  let assistantTokens = 0;
  let toolCalls = 0;

  // Start subscription in separate async context
  log("\n📡", "Starting response subscription...", colors.yellow);

  (async () => {
    try {
      for await (const message of session.subscribe()) {
        messageCount++;

        switch (message.type) {
          case "system":
            if (message.subtype === "init") {
              log("🔧", `System initialized with session ID: ${message.session_id}`, colors.dim);
            }
            break;

          case "user":
            // Echo user messages
            const userContent = typeof message.message.content === 'string'
              ? message.message.content
              : '[Complex message]';
            log("👤", `User: ${userContent}`, colors.blue);
            break;

          case "assistant":
            // Stream assistant responses
            if (typeof message.message.content === "string") {
              process.stdout.write(`${colors.green}🤖 AI: ${message.message.content}${colors.reset}`);
              // assistantTokens += message.message.content.length;
            } else if (Array.isArray(message.message.content)) {
              for (const block of message.message.content) {
                if (block.type === "text") {
                  process.stdout.write(`${colors.green}${block.text}${colors.reset}`);
                  assistantTokens += block.text.length;
                } else if (block.type === "tool_use") {
                  toolCalls++;
                  log("\n🔨", `Tool: ${block.name}`, colors.magenta);
                }
              }
            } else {
            }
            break;

          case "result":
            console.log("\n"); // New line after assistant response

            if (message.subtype === "success") {
              log("✨", "Request completed successfully!", colors.green);
              log("💰", `Cost: $${message.total_cost_usd || 0}`, colors.yellow);
              log("⏱️", `Duration: ${message.duration_ms || 0}ms`, colors.yellow);
            } else {
              log("❌", `Request failed: ${message.subtype}`, colors.red);
            }

            // Don't exit after first result - continue for more messages
            // The session will end when all messages are processed
            break;

          default:
            log("❓", `Unknown message type: ${message.type}`, colors.dim);
        }
      }
    } catch (error) {
      log("❌", `Subscription error: ${error}`, colors.red);
    }
  })();

  // Wait a bit for subscription to be ready
  await new Promise(resolve => setTimeout(resolve, 100));

  console.log(`\n${colors.bright}📤 Sending messages (non-blocking)...${colors.reset}\n`);

  // Example 1: Simple text message
  log("1️⃣", "Sending first message...", colors.cyan);
  await session.sendText("Hello! Please introduce yourself briefly.");
  log("✉️", "Message 1 sent (returned immediately)", colors.dim);

  // Small delay to show async nature
  await new Promise(resolve => setTimeout(resolve, 35000));

  // Example 2: Follow-up question
  log("\n2️⃣", "Sending second message...", colors.cyan);
  await session.sendText("What are your main capabilities?");
  log("✉️", "Message 2 sent (returned immediately)", colors.dim);

  // Example 3: Complex SDKUserMessage
  log("\n3️⃣", "Sending complex message...", colors.cyan);
  await session.sendText("Can you write a simple Python hello world function?");
  log("✉️", "Message 3 sent (returned immediately)", colors.dim);

  // Example 4: Batch send
  log("\n4️⃣", "Sending batch messages...", colors.cyan);
  await session.sendBatch([
    "What's 2+2?",
    "What's 10*10?"
  ]);
  log("✉️", "Batch messages sent (returned immediately)", colors.dim);

  // Wait for all responses to complete
  console.log(`\n${colors.dim}⏳ Waiting for all responses...${colors.reset}\n`);

  // Print statistics
  console.log(`\n${colors.bright}📊 Session Statistics:${colors.reset}`);
  console.log(`${colors.cyan}├─${colors.reset} Session ID: ${session.getSessionId() || 'Not set'}`);
  console.log(`${colors.cyan}├─${colors.reset} Total messages: ${messageCount}`);
  console.log(`${colors.cyan}├─${colors.reset} Assistant tokens (approx): ${assistantTokens}`);
  console.log(`${colors.cyan}├─${colors.reset} Tool calls: ${toolCalls}`);
  console.log(`${colors.cyan}├─${colors.reset} History length: ${session.getHistory().length}`);
  console.log(`${colors.cyan}└─${colors.reset} Session active: ${session.isActive()}`);

  // Close session
  session.close();
  log("\n🔒", "Session closed", colors.yellow);
  log("👋", "Test completed!\n", colors.green);
}

// Run the main test
if (import.meta.main) {
  (async () => {
    try {
      await main();
    } catch (error) {
      console.error(`${colors.red}Fatal error:${colors.reset}`, error);
      process.exit(1);
    }
  })();
}
