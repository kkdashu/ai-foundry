import '@/lib/undici-proxy'
import { tool as createTool } from 'ai'
import { z } from 'zod'
import { query, type Options } from '@anthropic-ai/claude-code'

export const claudeCodeTool = createTool({
  description:
    'Use Claude Code to inspect or modify repository files or run shell commands when absolutely necessary. Returns a summary and sessionId for continuity.',
  inputSchema: z.object({
    task: z
      .string()
      .describe(
        'Clear, specific instruction of what to read/edit/run. Include paths and expected outcome.'
      ),
    permissionMode: z
      .enum(['bypassPermissions', 'default',  'acceptEdits', 'plan'])
      .default('bypassPermissions')
      .describe('Controls whether Claude Code asks for permissions; server default bypass.'),
    continueConversation: z
      .boolean()
      .optional()
      .describe('Continue existing conversation turn context if available.'),
    sessionId: z
      .string()
      .optional()
      .describe('Resume a previous Claude Code session for multi-step tasks.'),
  }),
  // Execute on server only
  execute: async ({ task, permissionMode, continueConversation, sessionId }) => {
    const options: Options = {
      permissionMode: permissionMode || 'bypassPermissions',
    }

    if (continueConversation) options.continue = true
    if (sessionId) options.resume = sessionId

    let currentSessionId: string | null = sessionId ?? null
    let lastResult: any = null

    // Run Claude Code session
    const run = query({ prompt: task, options })

    for await (const message of run) {
      if ((message as any)?.session_id) currentSessionId = (message as any).session_id
      if ((message as any)?.type === 'result') {
        lastResult = message
      }
    }

    // Summarize output
    const summary:
      | string
      | undefined = lastResult?.result || lastResult?.message || undefined

    return {
      sessionId: currentSessionId ?? undefined,
      summary: summary ?? 'Task completed. No textual summary was provided.',
      usage: lastResult?.usage,
      totalCost: lastResult?.total_cost_usd,
    }
  },
})

export type ClaudeCodeTool = typeof claudeCodeTool

