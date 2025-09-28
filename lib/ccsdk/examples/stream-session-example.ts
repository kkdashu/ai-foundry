#!/usr/bin/env bun
/**
 * StreamSession Example
 * Demonstrates the true streaming capabilities of the Claude Code SDK
 */

import { StreamSession } from "../stream-session";
import * as fs from "fs";

async function main() {
  console.log("🚀 StreamSession Example\n");

  // Create a new streaming session
  const session = new StreamSession("demo-session", {
    maxTurns: 10,
    appendSystemPrompt: "You are a helpful coding assistant."
  });

  console.log("✅ Session created:", session.id);

  // Set up response subscription in a separate async context
  const subscriptionPromise = (async () => {
    console.log("\n📡 Subscribing to responses...\n");

    try {
      for await (const message of session.subscribe()) {
        // Handle different message types
        switch (message.type) {
          case "system":
            if (message.subtype === "init") {
              console.log(`[System] Session initialized: ${message.session_id}`);
            }
            break;

          case "user":
            console.log(`[User] ${message.message.content}`);
            break;

          case "assistant":
            // Stream assistant responses character by character
            if (typeof message.message.content === "string") {
              process.stdout.write(`[AI] ${message.message.content}`);
            } else if (Array.isArray(message.message.content)) {
              for (const block of message.message.content) {
                if (block.type === "text") {
                  process.stdout.write(block.text);
                }
              }
            }
            break;

          case "tool_use":
            console.log(`\n[Tool] Using ${message.name}...`);
            break;

          case "tool_result":
            console.log(`[Tool Result] ${message.is_error ? "Error" : "Success"}`);
            break;

          case "result":
            console.log(`\n[Result] ${message.subtype}`);
            if (message.subtype === "success") {
              console.log(`[Stats] Cost: $${message.total_cost_usd}, Duration: ${message.duration_ms}ms`);
            }
            return; // Exit subscription when done
        }
      }
    } catch (error) {
      console.error("Subscription error:", error);
    }
  })();

  // Send messages asynchronously
  console.log("\n📤 Sending messages...\n");

  // Example 1: Simple text message
  await session.sendText("Hello! Can you explain what a StreamSession is?");
  console.log("✉️ Sent message 1");

  // Wait a bit before sending next message
  await new Promise(resolve => setTimeout(resolve, 1000));

  // Example 2: Follow-up question
  await session.sendText("How is it different from a regular Session?");
  console.log("✉️ Sent message 2");

  // Example 3: Send a complete SDKUserMessage
  await session.send({
    type: "user",
    message: {
      role: "user",
      content: "Can you show me a simple code example?"
    }
  });
  console.log("✉️ Sent message 3");

  // Example 4: Send batch messages
  await session.sendBatch([
    "What are the main benefits?",
    "Are there any limitations I should know about?"
  ]);
  console.log("✉️ Sent batch messages");

  // Wait for subscription to complete
  await subscriptionPromise;

  // Check session state
  console.log("\n📊 Session Summary:");
  console.log("- Session ID:", session.getSessionId());
  console.log("- History length:", session.getHistory().length);
  console.log("- Is active:", session.isActive());

  // Close the session
  session.close();
  console.log("\n🔒 Session closed");
}

// Alternative example: Using convenience subscription methods
async function assistantOnlyExample() {
  console.log("\n🎯 Assistant-Only Subscription Example\n");

  const session = new StreamSession("assistant-demo");

  // Subscribe only to assistant messages
  const assistantPromise = (async () => {
    for await (const text of session.subscribeAssistant()) {
      console.log("Assistant:", text);
    }
  })();

  // Send a message
  await session.sendText("Tell me a short joke");

  // Wait for response
  await assistantPromise;

  session.close();
}

// Example with image
async function imageExample() {
  console.log("\n🖼️ Image Example\n");

  const session = new StreamSession("image-demo");

  // Subscribe to responses
  const subscriptionPromise = (async () => {
    for await (const text of session.subscribeAssistant()) {
      console.log(text);
    }
  })();

  // Send message with image (if image file exists)
  const imagePath = "./example-image.png";
  if (fs.existsSync(imagePath)) {
    await session.sendWithImageFile(
      "What's in this image?",
      imagePath
    );
  } else {
    // Send with base64 encoded image data
    const fakeImageData = "base64encodedimagedata";
    await session.sendWithImage(
      "Analyze this diagram",
      fakeImageData,
      "image/png"
    );
  }

  await subscriptionPromise;
  session.close();
}

// Example: Request-Response pattern
async function requestResponseExample() {
  console.log("\n🔄 Request-Response Pattern Example\n");

  const session = new StreamSession("req-res-demo");

  // Start subscription in background
  const subscriptionPromise = session.subscribe();

  // Send and wait for response
  await session.sendText("What is 2 + 2?");

  // Get the complete response
  const response = await session.getNextAssistantResponse();
  console.log("Complete response:", response);

  session.close();
}

// Run examples
if (import.meta.main) {
  (async () => {
    try {
      // Run main example
      await main();

      // Uncomment to run other examples
      // await assistantOnlyExample();
      // await imageExample();
      // await requestResponseExample();
    } catch (error) {
      console.error("Error:", error);
      process.exit(1);
    }
  })();
}