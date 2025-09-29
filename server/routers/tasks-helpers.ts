import { db, tasks, comments } from '@/lib/db'
import { eq } from 'drizzle-orm'
import { runTask } from '@/lib/ccsdk/sdk'
import type { Options } from '@anthropic-ai/claude-code'
import path from 'path'
import { promises as fs } from 'fs'
import { google } from '@ai-sdk/google'
import { generateText } from 'ai'
import { ensureProjectRoot, ensureTaskDir, ensureLandmarkDir } from '@/lib/local/project-fs'

// 路径验证函数
export function isPathLike(str: any) {
  return typeof str === 'string' && (str.includes('/') || str.includes('\\'))
}

export function normalizeAndCheckInside(base: string, candidate: string) {
  const abs = path.isAbsolute(candidate) ? candidate : path.join(base, candidate)
  const normBase = path.resolve(base)
  const normTarget = path.resolve(abs)
  return normTarget === normBase || normTarget.startsWith(normBase + path.sep)
}

export function inputWithinCwd(input: any, cwd: string): { ok: boolean; reason?: string } {
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

// 路径处理相关函数
export async function ensureTaskPaths(cwd: string, taskRow: any) {
  const root = await ensureProjectRoot(cwd)
  const lmDir = taskRow.landmarkId
    ? await ensureLandmarkDir(cwd, taskRow.landmarkId)
    : root
  const taskDir = taskRow.landmarkId
    ? await ensureTaskDir(cwd, taskRow.landmarkId, taskRow.id)
    : (async () => {
        const fallback = path.join(root, '_tasks', taskRow.id)
        await fs.mkdir(fallback, { recursive: true })
        return fallback
      })()
  return { root, landmarkDir: lmDir, taskDir: await taskDir }
}

export async function getParentTaskDir(cwd: string, parentId: string | null) {
  if (!parentId) return null
  const rows = await db.select().from(tasks).where(eq(tasks.id, parentId)).limit(1)
  if (!rows || rows.length === 0) return null
  const parent = rows[0]
  const root = await ensureProjectRoot(cwd)
  if (parent.landmarkId) return await ensureTaskDir(cwd, parent.landmarkId, parent.id)
  const fallback = path.join(root, '_tasks', parent.id)
  await fs.mkdir(fallback, { recursive: true })
  return fallback
}

// 构建提示词
export function buildPromptText(
  cwd: string,
  taskDescription: string,
  taskDirRel: string | null,
  parentDirRel: string | null,
  landmarkDirRel: string | null
): string {
  return [
    `你正在该项目目录下工作：${cwd}。所有文件与命令操作必须限定在此目录内。`,
    `请严格在项目根目录执行以下任务：`,
    `${taskDescription}`,
    '',
    '上下文与资料阅读要求：',
    `- 当前任务目录：${taskDirRel ?? '(无)'}`,
    parentDirRel ? `- 父任务目录：${parentDirRel}` : null,
    landmarkDirRel ? `- 里程碑目录：${landmarkDirRel}` : null,
    '请先递归遍历并阅读上述目录内的文档（如 .md/.txt/.rst/notes 等），理解现有信息后再动手。',
    '如需创建/修改文件请直接执行并给出简要说明；完成后回复"任务已完成"。',
  ].filter(Boolean).join('\n')
}

// 日志记录相关函数
export async function writeProcessHeader(
  outputPath: string,
  taskId: string,
  cwd: string,
  taskDirRel: string | null,
  parentDirRel: string | null,
  landmarkDirRel: string | null,
  promptText: string
) {
  const startHeader = `\n==== Process start ${new Date().toISOString()} ===\nTask: ${taskId}\nCWD: ${cwd}\nTaskDir: ${taskDirRel}\nParentDir: ${parentDirRel ?? ''}\nLandmarkDir: ${landmarkDirRel ?? ''}\nPrompt:\n${promptText}\n---- STREAM ----\n`
  await fs.appendFile(outputPath, startHeader, 'utf8')
}

export async function writeProcessFooter(
  outputPath: string,
  summary: string,
  sessionId: string | null,
  totalCost: any
) {
  const footer = `---- SUMMARY ----\n${summary}\nSession: ${sessionId ?? ''}\nCost(USD): ${totalCost ?? ''}\n==== Process end ${new Date().toISOString()} ====\n`
  await fs.appendFile(outputPath, footer, 'utf8')
}

// 执行任务并记录日志
export async function executeTask(
  promptText: string,
  options: Options,
  outputPath: string
): Promise<{
  lastResult: any
  sessionId: string | null
  events: Array<{ ts: string; type: string; raw: string; truncated?: boolean }>
}> {
  let lastResult: any = null
  let currentSessionId: string | null = null
  const events: Array<{ ts: string; type: string; raw: string; truncated?: boolean }> = []

  const run = runTask(promptText, options)

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
      const ts = new Date().toISOString()
      const line = `[${ts}] [${type}] ${raw}\n`
      await fs.appendFile(outputPath, line, 'utf8')
      events.push({ ts, type, raw, truncated })
      if (type === 'result') lastResult = message
      if (message.type == 'result') {
        if (message.subtype == 'success') {
          break;
        }
      }
    } catch {}
  }

  return { lastResult, sessionId: currentSessionId, events }
}

// 生成任务总结
export async function generateSummary(
  taskDescription: string,
  cwd: string,
  events: Array<{ ts: string; type: string; raw: string; truncated?: boolean }>,
  lastResult: any
): Promise<string> {
  let summary = lastResult?.result || lastResult?.message || ''

  try {
    if (process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
      const digestPieces: string[] = []
      for (const e of events.slice(-18)) {
        digestPieces.push(`[${e.type}] ${e.raw.slice(0, 600)}`)
      }
      const digest = digestPieces.join('\n')
      const prompt = `你是一个资深工程助理。用户的任务描述如下：\n${taskDescription}\n工作根目录：${cwd}\n以下是 Claude Code 执行过程的关键信息（已截断）：\n${digest}\n\n请用中文输出一段不超过 10 行的总结，包含：\n- 完成了哪些关键步骤（要点列表）\n- 创建/修改了哪些文件（相对路径）\n- 重要命令及结果（如有）\n- 是否还有后续建议。`
      const { text } = await generateText({ model: google('gemini-2.5-flash'), prompt })
      if (text && text.trim()) summary = text.trim()
    }
    if (!summary) summary = '任务执行完成，详情见评论内容的 events 部分。'
  } catch (err) {
    if (!summary) summary = '任务执行完成，详情见评论内容的 events 部分。'
  }

  return summary
}

// 生成清理后的日志
export async function writeCleanLog(
  taskDir: string,
  cwd: string,
  task: any,
  taskDirRel: string | null,
  parentDirRel: string | null,
  landmarkDirRel: string | null,
  events: Array<{ ts: string; type: string; raw: string; truncated?: boolean }>,
  summary: string
) {
  try {
    const assistantTexts: string[] = []
    const fileWrites: string[] = []

    for (const e of events) {
      try {
        const obj = JSON.parse(e.raw)
        const msg = obj?.message
        const role = msg?.role
        const content = Array.isArray(msg?.content) ? msg.content : []

        if (role === 'assistant') {
          for (const item of content) {
            if (item?.type === 'text' && typeof item.text === 'string') {
              const t = item.text.trim()
              if (t) assistantTexts.push(t)
            }
            if (item?.type === 'tool_use' && item?.name === 'Write') {
              const fp = item?.input?.file_path
              if (typeof fp === 'string' && fp) fileWrites.push(fp)
            }
          }
        }
      } catch {}
    }

    const clean: string[] = []
    clean.push('# 任务执行记录（精简版）')
    clean.push('')
    clean.push('## 任务描述')
    clean.push(task.description)
    clean.push('')
    clean.push('## 上下文目录')
    clean.push(`- 当前任务目录：${taskDirRel ?? '(无)'}`)
    if (parentDirRel) clean.push(`- 父任务目录：${parentDirRel}`)
    if (landmarkDirRel) clean.push(`- 里程碑目录：${landmarkDirRel}`)
    clean.push('')

    if (assistantTexts.length) {
      clean.push('## AI 关键说明')
      const seen = new Set<string>()
      for (const t of assistantTexts) {
        if (!seen.has(t)) {
          seen.add(t)
          clean.push(`- ${t}`)
        }
      }
      clean.push('')
    }

    if (fileWrites.length) {
      clean.push('## 文件写入')
      for (const f of fileWrites) {
        clean.push(`- ${path.isAbsolute(f) ? path.relative(cwd, f) : f}`)
      }
      clean.push('')
    }

    if (summary) {
      clean.push('## 执行总结')
      clean.push(summary)
      clean.push('')
    }

    const cleanPath = path.join(taskDir, 'process_output.clean.md')
    await fs.writeFile(cleanPath, clean.join('\n'), 'utf8')
  } catch {}
}
