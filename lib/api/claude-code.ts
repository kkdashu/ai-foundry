// API utility functions with type safety

import {
  ClaudeCodeRequest,
  ClaudeCodeStreamResponse,
  ApiErrorResponse,
  isStreamEndMessage,
  isStreamErrorMessage,
  isSessionIdUpdateMessage,
  isClaudeCodeStreamMessage
} from '../types/api'

export class ClaudeCodeAPI {
  private static readonly API_ENDPOINT = '/api/claude-code'

  /**
   * Send a request to Claude Code API with streaming response
   */
  static async sendMessage(
    request: ClaudeCodeRequest,
    onStreamMessage: (message: ClaudeCodeStreamResponse) => void,
    onError: (error: string) => void
  ): Promise<void> {
    try {
      const response = await fetch(this.API_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      if (!response.body) {
        throw new Error('Response body is null')
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value, { stream: true })
        const lines = chunk.split('\n')

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const jsonStr = line.slice(6) // Remove 'data: ' prefix
              if (jsonStr.trim()) {
                const data = JSON.parse(jsonStr) as ClaudeCodeStreamResponse

                // Type-safe handling of different message types
                if (isStreamErrorMessage(data)) {
                  onError(data.error)
                  return
                } else if (isSessionIdUpdateMessage(data)) {
                  // SessionId update messages are handled immediately
                  onStreamMessage(data)
                } else if (isStreamEndMessage(data)) {
                  // Stream end messages contain final metadata
                  onStreamMessage(data)
                } else if (isClaudeCodeStreamMessage(data)) {
                  // Regular Claude Code messages
                  onStreamMessage(data)
                }
              }
            } catch (parseError) {
              console.warn('Failed to parse streaming data:', parseError)
            }
          }
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
      onError(errorMessage)
    }
  }

  /**
   * Validate request before sending
   */
  static validateRequest(request: ClaudeCodeRequest): string | null {
    if (!request.prompt && (!request.images || request.images.length === 0)) {
      return 'Prompt or images are required'
    }

    if (request.images) {
      for (const image of request.images) {
        if (!image.data || !image.mimeType) {
          return 'Invalid image data'
        }
        if (image.size > 10 * 1024 * 1024) { // 10MB limit
          return `Image ${image.name} is too large (max 10MB)`
        }
      }
    }

    return null
  }

  /**
   * Create a properly typed request object
   */
  static createRequest(
    prompt: string,
    images: any[] = [],
    continueConversation: boolean = true,
    sessionId: string | null = null,
    permissionMode: ClaudeCodeRequest['permissionMode'] = 'bypassPermissions'
  ): ClaudeCodeRequest {
    return {
      prompt,
      images: images.length > 0 ? images : undefined,
      continue: continueConversation,
      sessionId,
      permissionMode
    }
  }
}