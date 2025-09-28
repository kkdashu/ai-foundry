#!/usr/bin/env bun
/**
 * Test true streaming input as documented
 * This shows how streaming input actually works in Claude Code SDK
 */

import { query } from "@anthropic-ai/claude-code";
import type { SDKMessage } from "./types";

const colors = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  green: "\x1b[32m",
  blue: "\x1b[34m",
  yellow: "\x1b[33m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m"
};

async function testStreamingInput() {
  console.log(`${colors.bright}🌊 True Streaming Input Test${colors.reset}\n`);
  console.log("This test demonstrates how streaming input really works:\n");
  console.log("1. All messages are yielded from a generator");
  console.log("2. The SDK processes them in sequence");
  console.log("3. All messages are part of ONE query call\n");

  // Create a message generator that yields multiple messages
  async function* messageGenerator() {
    console.log(`${colors.cyan}📤 Yielding message 1...${colors.reset}`);
    yield {
      type: "user" as const,
      message: {
        role: "user" as const,
        content: "Hello! Please count from 1 to 3."
      }
    };

    // Simulate delay between messages
    console.log(`${colors.yellow}⏳ Waiting 1 second...${colors.reset}`);
    await new Promise(resolve => setTimeout(resolve, 1000));

    console.log(`${colors.cyan}📤 Yielding message 2...${colors.reset}`);
    yield {
      type: "user" as const,
      message: {
        role: "user" as const,
        content: "Now count from 4 to 6."
      }
    };

    console.log(`${colors.yellow}⏳ Waiting 1 second...${colors.reset}`);
    await new Promise(resolve => setTimeout(resolve, 1000));

    console.log(`${colors.cyan}📤 Yielding message 3...${colors.reset}`);
    yield {
      type: "user" as const,
      message: {
        role: "user" as const,
        content: "Finally, count from 7 to 9."
      }
    };

    console.log(`${colors.green}✅ All messages yielded${colors.reset}\n`);
  }

  // Process responses from the single query call
  console.log(`${colors.bright}Starting query with streaming input...${colors.reset}\n`);

  let turnCount = 0;
  let messageCount = 0;

  try {
    for await (const message of query({
      prompt: messageGenerator(),
      options: {
        maxTurns: 10,  // Allow multiple turns
        appendSystemPrompt: "Keep responses very short."
      }
    })) {
      messageCount++;

      switch (message.type) {
        case "system":
          if (message.subtype === "init") {
            console.log(`${colors.magenta}[System] Session: ${message.session_id}${colors.reset}`);
          }
          break;

        case "user":
          turnCount++;
          const content = typeof message.message.content === 'string'
            ? message.message.content
            : '[Complex content]';
          console.log(`${colors.blue}[Turn ${turnCount}] User: ${content}${colors.reset}`);
          break;

        case "assistant":
          if (typeof message.message.content === "string") {
            process.stdout.write(`${colors.green}[Turn ${turnCount}] AI: ${message.message.content}${colors.reset}`);
          }
          break;

        case "result":
          if (message.subtype === "success") {
            console.log(`\n${colors.bright}✨ Completed!${colors.reset}`);
            console.log(`Cost: $${message.total_cost_usd}`);
            console.log(`Duration: ${message.duration_ms}ms`);
          }
          break;
      }
    }
  } catch (error) {
    console.error(`${colors.bright}❌ Error:${colors.reset}`, error);
  }

  console.log(`\n${colors.bright}📊 Summary:${colors.reset}`);
  console.log(`- Turns processed: ${turnCount}`);
  console.log(`- Total messages: ${messageCount}`);
  console.log(`- This was all ONE query() call with streaming input!`);
}

// Alternative: Pre-generate all messages
async function testPreGeneratedMessages() {
  console.log(`\n${colors.bright}📦 Pre-Generated Messages Test${colors.reset}\n`);

  // Generate all messages upfront
  const messages = [
    {
      type: "user" as const,
      message: {
        role: "user" as const,
        content: "What's the capital of France?"
      }
    },
    {
      type: "user" as const,
      message: {
        role: "user" as const,
        content: "What's the capital of Germany?"
      }
    },
    {
      type: "user" as const,
      message: {
        role: "user" as const,
        content: "What's the capital of Spain?"
      }
    }
  ];

  // Create generator from array
  async function* arrayGenerator() {
    for (const msg of messages) {
      console.log(`Yielding: ${msg.message.content}`);
      yield msg;
    }
  }

  // Process with single query
  for await (const message of query({
    prompt: arrayGenerator(),
    options: { maxTurns: 5 }
  })) {
    if (message.type === "assistant") {
      process.stdout.write(`${colors.green}AI: ${message.message.content}${colors.reset}`);
    }
  }
}

if (import.meta.main) {
  (async () => {
    await testStreamingInput();
    // await testPreGeneratedMessages();
  })();
}