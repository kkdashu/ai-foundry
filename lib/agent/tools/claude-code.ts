import '@/lib/undici-proxy'
import { tool as createTool } from 'ai'
import { z } from 'zod'
import { query, type Options } from '@anthropic-ai/claude-code'
import path from 'path'

type ToolOpts = { cwd?: string; defaultSessionId?: string; alwaysContinue?: boolean }

function isPathLike(str: string) {
  if (typeof str !== 'string') return false
  return str.includes('/') || str.includes('\\')
}

function normalizeAndCheckInside(base: string, candidate: string) {
  const abs = path.isAbsolute(candidate) ? candidate : path.join(base, candidate)
  const normBase = path.resolve(base)
  const normTarget = path.resolve(abs)
  return normTarget === normBase || normTarget.startsWith(normBase + path.sep)
}

function inputWithinCwd(input: any, cwd: string): { ok: boolean; reason?: string } {
  try {
    const visit = (val: any): boolean => {
      if (!val) return true
      if (typeof val === 'string') {
        if (!isPathLike(val)) return true
        // Basic traversal guard
        if (val.includes('..')) {
          if (!normalizeAndCheckInside(cwd, val)) return false
          return true
        }
        // Absolute path guard
        if (path.isAbsolute(val) && !normalizeAndCheckInside(cwd, val)) return false
        return true
      }
      if (Array.isArray(val)) return val.every(visit)
      if (typeof val === 'object') return Object.values(val).every(visit)
      return true
    }
    const ok = visit(input)
    return ok ? { ok } : { ok: false, reason: 'Path escapes project directory' }
  } catch (err: any) {
    return { ok: false, reason: err?.message || 'Validation error' }
  }
}

export const makeClaudeCodeTool = (opts?: ToolOpts) => createTool({
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
    try {
      // if (!process.env.ANTHROPIC_API_KEY) {
      //   console.warn('[claudeCode] ANTHROPIC_API_KEY is not set. The Claude Code SDK may fail to run.')
      // }

      // Debug log for task prompt and context
    // Decide permission mode:
    // - If env CLAUDE_CODE_PERMISSION_MODE is set, use it (override)
    // - Otherwise, if model passed 'default' or nothing, upgrade to 'bypassPermissions'
    // - If model passed another explicit value (acceptEdits/plan), respect it
    const envMode = (process.env.CLAUDE_CODE_PERMISSION_MODE as any) as
      | 'bypassPermissions'
      | 'default'
      | 'acceptEdits'
      | 'plan'
      | undefined
    const effectiveMode: 'bypassPermissions' | 'default' | 'acceptEdits' | 'plan' =
      envMode ?? (!permissionMode || permissionMode === 'default' ? 'bypassPermissions' : permissionMode)
      const head = (s: string, n = 400) => (s && s.length > n ? s.slice(0, n) + '…' : s)
      console.log('[claudeCode] Execute', {
        cwd: opts?.cwd,
        permissionMode: effectiveMode,
        continueConversation,
        sessionId,
        taskPreview: head(task || ''),
      })
    const options: Options = {
      permissionMode: effectiveMode,
      ...(opts?.cwd ? { cwd: opts.cwd } : {}),
      ...(opts?.cwd
        ? {
            canUseTool: async (toolName, input) => {
              const check = inputWithinCwd(input, opts.cwd!)
              if (!check.ok) {
                return { behavior: 'deny', message: `Blocked ${toolName}: ${check.reason}` }
              }
              return { behavior: 'allow', updatedInput: input }
            },
          }
        : {}),
    }

    if (continueConversation || opts?.alwaysContinue) options.continue = true
    const resumeId = sessionId || opts?.defaultSessionId
    if (resumeId) options.resume = resumeId

    let currentSessionId: string | null = sessionId ?? null
    let lastResult: any = null

    // Build AsyncIterable prompt to enable canUseTool/stream-json mode
    const promptStream: AsyncIterable<any> = (async function* () {
      yield {
        type: 'user' as const,
        session_id: currentSessionId || '',
        message: {
          role: 'user' as const,
          content: [{ type: 'text', text: task }],
        },
        parent_tool_use_id: null,
      }
    })()

    const run = query({ prompt: promptStream, options })

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
    } catch (err: any) {
      const message = err?.message || String(err)
      console.error('[claudeCode] Tool execution error:', message)
      if (!process.env.ANTHROPIC_API_KEY) {
        return {
          sessionId: sessionId || undefined,
          summary: `Claude Code 执行失败：缺少 ANTHROPIC_API_KEY。请在服务端设置该环境变量后重试。错误：${message}`,
        }
      }
      return { sessionId: sessionId || undefined, summary: `Claude Code 执行失败：${message}` }
    }
  },
})

// Default tool without custom cwd (falls back to process.cwd())
export const claudeCodeTool = makeClaudeCodeTool()

export type ClaudeCodeTool = ReturnType<typeof makeClaudeCodeTool>
