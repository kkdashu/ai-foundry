import type { SDKUserMessage, SDKMessage } from "@anthropic-ai/claude-code";

export type { SDKUserMessage, SDKMessage };

export interface QueryResult {
  messages: SDKMessage[];
  cost: number;
  duration: number;
}

export interface StreamOptions {
  onMessage?: (message: SDKMessage) => void;
  onError?: (error: Error) => void;
  onComplete?: () => void;
}