import { NextRequest, NextResponse } from 'next/server'
import { db, tasks, comments } from '@/lib/db'
import { eq } from 'drizzle-orm'
import { getLocalPath } from '@/lib/local/registry'
import { query, type Options } from '@anthropic-ai/claude-code'
import path from 'path'
import { google } from '@ai-sdk/google'
import { generateText } from 'ai'

export const maxDuration = 300

function isPathLike(str: any) {
  return typeof str === 'string' && (str.includes('/') || str.includes('\\'))
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
        if (val.includes('..')) {
          if (!normalizeAndCheckInside(cwd, val)) return false
          return true
        }
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

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    if (!id) return NextResponse.json({ error: 'Missing task id' }, { status: 400 })

    const rows = await db.select().from(tasks).where(eq(tasks.id, id)).limit(1)
    if (!rows || rows.length === 0) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 })
    }
    const task = rows[0]

    const cwd = await getLocalPath(task.projectId)
    if (!cwd) {
      return NextResponse.json({ error: 'Local project path not bound' }, { status: 400 })
    }

    // Mark as in_progress
    await db.update(tasks).set({ status: 'in_progress', updatedAt: new Date() }).where(eq(tasks.id, id))

    const envMode = process.env.CLAUDE_CODE_PERMISSION_MODE as
      | 'bypassPermissions'
      | 'default'
      | 'acceptEdits'
      | 'plan'
      | undefined
    const permissionMode = envMode ?? 'bypassPermissions'

    const options: Options = {
      permissionMode,
      cwd,
      canUseTool: async (toolName, input) => {
        const check = inputWithinCwd(input, cwd)
        if (!check.ok) {
          return { behavior: 'deny', message: `Blocked ${toolName}: ${check.reason}` }
        }
        return { behavior: 'allow', updatedInput: input }
      },
    }

    const promptText =
      `你正在该项目目录下工作：${cwd}。所有文件与命令操作必须限定在此目录内。` +
      `\n请严格在项目根目录执行以下任务：\n${task.description}\n` +
      `\n要求：如需创建/修改文件请直接执行并给出简要说明；完成后回复“任务已完成”。`

    // Build AsyncIterable prompt to support canUseTool
    const promptStream: AsyncIterable<any> = (async function* () {
      yield {
        type: 'user' as const,
        session_id: '',
        message: { role: 'user' as const, content: [{ type: 'text', text: promptText }] },
        parent_tool_use_id: null,
      }
    })()

    let lastResult: any = null
    let currentSessionId: string | null = null
    const run = query({ prompt: promptStream, options })
    const events: Array<{ ts: string; type: string; raw: string; truncated?: boolean }> = []
    for await (const message of run) {
      if ((message as any)?.session_id) currentSessionId = (message as any).session_id
      const type = (message as any)?.type || 'unknown'
      try {
        let raw = JSON.stringify(message)
        let truncated = false
        const LIMIT = 15000
        if (raw.length > LIMIT) {
          raw = raw.slice(0, LIMIT) + '...[truncated]'
          truncated = true
        }
        events.push({ ts: new Date().toISOString(), type, raw, truncated })
      } catch {
        // ignore
      }
      if (type === 'result') lastResult = message
    }

    // Try to generate a concise summary using Gemini. Fall back to simple summary on failure
    let summary = lastResult?.result || lastResult?.message || ''
    try {
      if (process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
        const digestPieces: string[] = []
        const maxEventsForDigest = 18
        for (const e of events.slice(-maxEventsForDigest)) {
          digestPieces.push(`[${e.type}] ${e.raw.slice(0, 600)}`)
        }
        const digest = digestPieces.join('\n')
        const prompt =
          `你是一个资深工程助理。用户的任务描述如下：\n${task.description}\n` +
          `工作根目录：${cwd}\n` +
          `以下是 Claude Code 执行过程的关键信息（已截断）：\n${digest}\n\n` +
          `请用中文输出一段不超过 10 行的总结，包含：\n` +
          `- 完成了哪些关键步骤（要点列表）\n- 创建/修改了哪些文件（相对路径）\n- 重要命令及结果（如有）\n- 是否还有后续建议。`
        const { text } = await generateText({ model: google('gemini-2.5-flash'), prompt })
        if (text && text.trim()) summary = text.trim()
      }
      if (!summary) summary = '任务执行完成，详情见评论内容的 events 部分。'
    } catch (err) {
      console.warn('Summary generation failed:', err)
      if (!summary) summary = '任务执行完成，详情见评论内容的 events 部分。'
    }

    // Persist comment with full content
    const content = {
      prompt: promptText,
      cwd,
      result: {
        sessionId: currentSessionId ?? undefined,
        usage: lastResult?.usage,
        totalCost: lastResult?.total_cost_usd,
      },
      events,
    }

    await db.insert(comments).values({ taskId: id, author: 'ClaudeCode', summary, content })

    await db.update(tasks).set({ status: 'completed', updatedAt: new Date() }).where(eq(tasks.id, id))

    return NextResponse.json({ ok: true, sessionId: currentSessionId ?? undefined, summary, usage: lastResult?.usage, totalCost: lastResult?.total_cost_usd })
  } catch (err: any) {
    console.error('Task process error:', err)
    try {
      const { id } = await params
      if (id) await db.update(tasks).set({ status: 'pending', updatedAt: new Date() }).where(eq(tasks.id, id))
      // Also store a failure comment to keep traceability
      try {
        await db.insert(comments).values({
          taskId: id,
          author: 'ClaudeCode',
          summary: `执行失败：${err?.message || 'Unknown error'}`,
          content: { error: String(err) },
        })
      } catch {}
    } catch {}
    return NextResponse.json({ error: err?.message || 'Failed to process task' }, { status: 500 })
  }
}
