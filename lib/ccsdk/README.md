# Claude Code SDK

A TypeScript SDK for building applications with Claude Code.

## Installation

```bash
bun install
```

## Usage

```typescript
import { AIClient, Session } from "@ai-foundry/ccsdk";

// Create an AI client
const client = new AIClient({
  maxTurns: 10,
  appendSystemPrompt: "You are a helpful assistant."
});

// Create a session for multi-turn conversations
const session = new Session("my-session");

// Send a message and get response
const result = await session.sendMessage("Hello, Claude!");
console.log(result.messages);

// Stream messages
for await (const message of session.sendMessageStream("Tell me a story")) {
  console.log(message);
}
```

## Custom Tools

```typescript
import { createCustomServer, CustomTool } from "@ai-foundry/ccsdk";
import { z } from "zod";

const myTool: CustomTool = {
  name: "my_tool",
  description: "My custom tool",
  schema: {
    input: z.string().describe("Input text")
  },
  handler: async ({ input }) => ({
    content: [{
      type: "text",
      text: `Processed: ${input}`
    }]
  })
};

const server = createCustomServer("my-server", "1.0.0", [myTool]);
```

## StreamSession (New!)

True streaming architecture that maintains a single persistent connection:

```typescript
import { StreamSession } from "@ai-foundry/ccsdk";

// Create a streaming session
const session = new StreamSession("chat-session");

// Subscribe to responses (in separate async context)
(async () => {
  for await (const message of session.subscribe()) {
    if (message.type === "assistant") {
      console.log("AI:", message.message.content);
    }
  }
})();

// Send messages without waiting for responses
await session.sendText("Hello!");
await session.sendText("How are you?");

// Send with images
await session.sendWithImage(
  "What's in this image?",
  imageBase64,
  "image/png"
);

// Send raw SDKUserMessage
await session.send({
  type: "user",
  message: { role: "user", content: "Complex message" }
});

// Close when done
session.close();
```

### Key Features of StreamSession:
- **Single query() call**: Entire session uses one persistent connection
- **Async send/receive**: Send messages without blocking for responses
- **True streaming**: Messages flow continuously in both directions
- **Flexible subscriptions**: Subscribe to all messages or just specific types

## API

### AIClient

- `constructor(options?: AIQueryOptions)` - Create a new AI client
- `querySingle(prompt: string, options?: AIQueryOptions)` - Send a single query
- `queryStream(prompt: string | AsyncIterable<SDKUserMessage>, options?: AIQueryOptions)` - Stream responses

### Session

- `constructor(id: string, options?: AIQueryOptions)` - Create a new session
- `sendMessage(content: string, options?: AIQueryOptions)` - Send a message
- `sendMessageStream(content: string, options?: AIQueryOptions)` - Stream message responses
- `getHistory()` - Get message history
- `reset()` - Reset the session
- `cleanup()` - Clean up resources

### MessageQueue

- `push(item: T)` - Add an item to the queue
- `next()` - Get the next item
- `close()` - Close the queue
- `isClosed()` - Check if queue is closed

## Testing

Run tests with:

```bash
# Run all tests
bun test

# Watch mode
bun test --watch

# Coverage report
bun test --coverage
```

## License

MIT