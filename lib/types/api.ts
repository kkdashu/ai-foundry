// Shared type definitions for frontend and backend API consistency

export interface UploadedImage {
  id: string
  data: string
  mimeType: string
  name: string
  size: number
  preview: string
}

export interface TokenUsage {
  input_tokens: number
  output_tokens: number
  cache_creation_input_tokens?: number
  cache_read_input_tokens?: number
}

export type PermissionMode = 'default' | 'acceptEdits' | 'bypassPermissions' | 'plan'

// API Request Types
export interface ClaudeCodeRequest {
  prompt: string
  images?: UploadedImage[]
  continue: boolean
  sessionId: string | null
  permissionMode: PermissionMode
}

// API Response Types
export interface ClaudeCodeStreamMessage {
  type: string
  message?: {
    role: 'user' | 'assistant'
    content: Array<{
      type: 'text' | 'image'
      text?: string
      source?: {
        type: 'base64'
        media_type: string
        data: string
      }
    }>
  }
  result?: string
  session_id?: string
  usage?: TokenUsage
  total_cost_usd?: number
  [key: string]: any
}

export interface StreamEndMessage {
  type: 'stream_end'
  sessionId: string | null
  usage: TokenUsage | null
  totalCost: number
}

export interface StreamErrorMessage {
  type: 'stream_error'
  error: string
}

export interface SessionIdUpdateMessage {
  type: 'session_update'
  sessionId: string
}

export type ClaudeCodeStreamResponse = ClaudeCodeStreamMessage | StreamEndMessage | StreamErrorMessage | SessionIdUpdateMessage

// Frontend Message Types
export interface Message {
  type: 'user' | 'assistant'
  content: string
  images?: UploadedImage[]
  timestamp: Date
  usage?: TokenUsage
  cost?: number
}

// API Error Response
export interface ApiErrorResponse {
  error: string
}

// Type guards for runtime type checking
export function isStreamEndMessage(message: ClaudeCodeStreamResponse): message is StreamEndMessage {
  return message.type === 'stream_end'
}

export function isStreamErrorMessage(message: ClaudeCodeStreamResponse): message is StreamErrorMessage {
  return message.type === 'stream_error'
}

export function isSessionIdUpdateMessage(message: ClaudeCodeStreamResponse): message is SessionIdUpdateMessage {
  return message.type === 'session_update'
}

export function isClaudeCodeStreamMessage(message: ClaudeCodeStreamResponse): message is ClaudeCodeStreamMessage {
  return !isStreamEndMessage(message) && !isStreamErrorMessage(message) && !isSessionIdUpdateMessage(message)
}

// HTTP Response wrapper
export interface ApiResponse<T> {
  data?: T
  error?: string
  status: number
}

// Session state
export interface SessionState {
  sessionId: string | null
  continueConversation: boolean
  permissionMode: PermissionMode
  totalTokens: {
    input: number
    output: number
    total: number
  }
  totalCost: number
}