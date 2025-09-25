import { createTRPCRouter, publicProcedure } from '@/server/trpc'
import { db, tasks, comments } from '@/lib/db'
import { TaskSchema, NewTaskSchema } from '@/lib/api/schemas'
import { z } from 'zod'
import { eq, and } from 'drizzle-orm'
import { getLocalPath } from '@/lib/local/registry'
import { ensureProjectRoot, ensureTaskDir, ensureLandmarkDir } from '@/lib/local/project-fs'
import { query, type Options } from '@anthropic-ai/claude-code'
import path from 'path'
import { google } from '@ai-sdk/google'
import { generateText } from 'ai'
import { promises as fs } from 'fs'

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

export const tasksRouter = createTRPCRouter({
  list: publicProcedure
    .input(z.object({ projectId: z.string().uuid(), landmarkId: z.string().uuid().optional() }))
    .output(z.array(TaskSchema))
    .query(async ({ input }) => {
      const cond = input.landmarkId
        ? and(eq(tasks.projectId, input.projectId), eq(tasks.landmarkId, input.landmarkId))
        : eq(tasks.projectId, input.projectId)
      const rows = await db.select().from(tasks).where(cond).orderBy(tasks.createdAt)
      return rows as any
    }),

  create: publicProcedure
    .input(NewTaskSchema)
    .output(TaskSchema)
    .mutation(async ({ input }) => {
      const inserted = await db.insert(tasks).values({
        projectId: input.projectId,
        description: input.description,
        status: input.status || 'pending',
        landmarkId: (input as any).landmarkId ?? null,
        predecessorId: (input as any).predecessorId ?? null,
      }).returning()
      const row = inserted[0]
      try {
        const cwd = await getLocalPath(row.projectId)
        if (cwd) {
          await ensureProjectRoot(cwd)
          if (row.landmarkId) await ensureTaskDir(cwd, row.landmarkId, row.id)
        }
      } catch (err) {
        console.warn('ensureTaskDir failed:', (err as any)?.message || err)
      }
      return row as any
    }),

  update: publicProcedure
    .input(z.object({
      id: z.string().uuid(),
      description: z.string().optional(),
      status: z.string().optional(),
      predecessorId: z.string().uuid().nullable().optional(),
    }))
    .output(TaskSchema)
    .mutation(async ({ input }) => {
      const updates: any = {}
      if (typeof input.description === 'string') updates.description = input.description
      if (typeof input.status === 'string') updates.status = input.status
      if ('predecessorId' in input) updates.predecessorId = input.predecessorId ?? null
      updates.updatedAt = new Date()
      const updated = await db.update(tasks).set(updates).where(eq(tasks.id, input.id)).returning()
      if (!updated || updated.length === 0) throw new Error('Task not found')
      return updated[0] as any
    }),

  delete: publicProcedure
    .input(z.object({ id: z.string().uuid() }))
    .output(z.object({ ok: z.boolean() }))
    .mutation(async ({ input }) => {
      const deleted = await db.delete(tasks).where(eq(tasks.id, input.id)).returning()
      if (!deleted || deleted.length === 0) throw new Error('Task not found')
      return { ok: true }
    }),

  process: publicProcedure
    .input(z.object({ id: z.string().uuid() }))
    .output(z.object({ ok: z.boolean(), summary: z.string(), sessionId: z.string().optional(), usage: z.any().optional(), totalCost: z.number().optional() }))
    .mutation(async ({ input }) => {
      const startTaskId = input.id

      const visited = new Set<string>()

      async function ensureTaskPaths(cwd: string, taskRow: any) {
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

      async function getParentTaskDir(cwd: string, parentId: string | null) {
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

      const envMode = process.env.CLAUDE_CODE_PERMISSION_MODE as 'bypassPermissions' | 'default' | 'acceptEdits' | 'plan' | undefined
      const permissionMode = envMode ?? 'bypassPermissions'

      async function processOne(taskId: string): Promise<{ sessionId?: string; summary: string; usage?: any; totalCost?: number }> {
        if (visited.has(taskId)) {
          return { summary: `已跳过循环引用的任务 ${taskId}` }
        }
        visited.add(taskId)

        const rows = await db.select().from(tasks).where(eq(tasks.id, taskId)).limit(1)
        if (!rows || rows.length === 0) throw new Error('Task not found')
        const task = rows[0]

        const cwd = await getLocalPath(task.projectId)
        if (!cwd) throw new Error('Local project path not bound')

        // Ensure directories exist and compute paths
        const { root, landmarkDir, taskDir } = await ensureTaskPaths(cwd, task)
        const parentTaskDir = await getParentTaskDir(cwd, (task as any).predecessorId ?? null)

        // Mark task in progress
        await db.update(tasks).set({ status: 'in_progress', updatedAt: new Date() }).where(eq(tasks.id, taskId))

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

        const rel = (p: string | null) => (p ? path.relative(cwd, p) || '.' : null)
        const taskDirRel = rel(taskDir)
        const parentDirRel = rel(parentTaskDir)
        const landmarkDirRel = rel(landmarkDir)

        const promptText = [
          `你正在该项目目录下工作：${cwd}。所有文件与命令操作必须限定在此目录内。`,
          `请严格在项目根目录执行以下任务：`,
          `${task.description}`,
          '',
          '上下文与资料阅读要求：',
          `- 当前任务目录：${taskDirRel ?? '(无)'}`,
          parentDirRel ? `- 父任务目录：${parentDirRel}` : null,
          landmarkDirRel ? `- 里程碑目录：${landmarkDirRel}` : null,
          '请先递归遍历并阅读上述目录内的文档（如 .md/.txt/.rst/notes 等），理解现有信息后再动手。',
          '如需创建/修改文件请直接执行并给出简要说明；完成后回复“任务已完成”。',
        ].filter(Boolean).join('\n')

        const promptStream: AsyncIterable<any> = (async function* () {
          yield { type: 'user' as const, session_id: '', message: { role: 'user' as const, content: [{ type: 'text', text: promptText }] }, parent_tool_use_id: null }
        })()

        // Prepare process_output file in current task directory
        const outputPath = path.join(taskDir, 'process_output')
        const startHeader = `\n==== Process start ${new Date().toISOString()} ===\nTask: ${taskId}\nCWD: ${cwd}\nTaskDir: ${taskDirRel}\nParentDir: ${parentDirRel ?? ''}\nLandmarkDir: ${landmarkDirRel ?? ''}\nPrompt:\n${promptText}\n---- STREAM ----\n`
        await fs.appendFile(outputPath, startHeader, 'utf8')

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
            if (raw.length > LIMIT) { raw = raw.slice(0, LIMIT) + '...[truncated]'; truncated = true }
            const ts = new Date().toISOString()
            const line = `[${ts}] [${type}] ${raw}\n`
            await fs.appendFile(outputPath, line, 'utf8')
            events.push({ ts, type, raw, truncated })
          } catch {}
          if (type === 'result') lastResult = message
        }

        let summary = lastResult?.result || lastResult?.message || ''
        try {
          if (process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
            const digestPieces: string[] = []
            for (const e of events.slice(-18)) digestPieces.push(`[${e.type}] ${e.raw.slice(0, 600)}`)
            const digest = digestPieces.join('\n')
            const prompt = `你是一个资深工程助理。用户的任务描述如下：\n${task.description}\n工作根目录：${cwd}\n以下是 Claude Code 执行过程的关键信息（已截断）：\n${digest}\n\n请用中文输出一段不超过 10 行的总结，包含：\n- 完成了哪些关键步骤（要点列表）\n- 创建/修改了哪些文件（相对路径）\n- 重要命令及结果（如有）\n- 是否还有后续建议。`
            const { text } = await generateText({ model: google('gemini-2.5-flash'), prompt })
            if (text && text.trim()) summary = text.trim()
          }
          if (!summary) summary = '任务执行完成，详情见评论内容的 events 部分。'
        } catch (err) {
          if (!summary) summary = '任务执行完成，详情见评论内容的 events 部分。'
        }

        // Append footer to process_output
        const footer = `---- SUMMARY ----\n${summary}\nSession: ${currentSessionId ?? ''}\nCost(USD): ${lastResult?.total_cost_usd ?? ''}\n==== Process end ${new Date().toISOString()} ====\n`
        await fs.appendFile(outputPath, footer, 'utf8')

        const content = { prompt: promptText, cwd, result: { sessionId: currentSessionId ?? undefined, usage: lastResult?.usage, totalCost: lastResult?.total_cost_usd }, events }
        await db.insert(comments).values({ taskId, author: 'ClaudeCode', summary, content })

        await db.update(tasks).set({ status: 'completed', updatedAt: new Date() }).where(eq(tasks.id, taskId))

        // Also write a cleaned, human-friendly log alongside raw process_output
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
            for (const t of assistantTexts) { if (!seen.has(t)) { seen.add(t); clean.push(`- ${t}`) } }
            clean.push('')
          }
          if (fileWrites.length) {
            clean.push('## 文件写入')
            for (const f of fileWrites) clean.push(`- ${path.isAbsolute(f) ? path.relative(cwd, f) : f}`)
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

        return { sessionId: currentSessionId ?? undefined, summary, usage: lastResult?.usage, totalCost: lastResult?.total_cost_usd }
      }

      // Process the initial task, then recursively process all children (successors)
      const first = await processOne(startTaskId)

      // Walk children depth-first
      async function processChildren(parentId: string) {
        const kids = await db.select().from(tasks).where(eq(tasks.predecessorId, parentId)).orderBy(tasks.createdAt)
        for (const child of kids) {
          // Only process tasks within the same project tree
          await processOne(child.id)
          await processChildren(child.id)
        }
      }
      await processChildren(startTaskId)

      return { ok: true, sessionId: first.sessionId, summary: first.summary, usage: first.usage, totalCost: first.totalCost }
    }),

  // Extract useful human-readable text from a task's process_output and save as process_output.clean.md
  cleanOutput: publicProcedure
    .input(z.object({ id: z.string().uuid() }))
    .output(z.object({ ok: z.boolean(), cleanedPath: z.string(), keptSections: z.array(z.string()) }))
    .mutation(async ({ input }) => {
      const id = input.id
      const rows = await db.select().from(tasks).where(eq(tasks.id, id)).limit(1)
      if (!rows || rows.length === 0) throw new Error('Task not found')
      const task = rows[0]

      const cwd = await getLocalPath(task.projectId)
      if (!cwd) throw new Error('Local project path not bound')

      // Resolve taskDir similar to processOne()
      const root = await ensureProjectRoot(cwd)
      let taskDir: string
      if (task.landmarkId) {
        taskDir = await ensureTaskDir(cwd, task.landmarkId, task.id)
      } else {
        taskDir = path.join(root, '_tasks', task.id)
        await fs.mkdir(taskDir, { recursive: true })
      }

      const processOutputPath = path.join(taskDir, 'process_output')
      const cleanPath = path.join(taskDir, 'process_output.clean.md')
      const exists = await fs.stat(processOutputPath).then(() => true).catch(() => false)
      if (!exists) {
        // Create empty clean file with a note
        const note = `# 任务执行记录（精简版）\n\n未找到原始日志：${path.relative(cwd, processOutputPath)}\n`
        await fs.writeFile(cleanPath, note, 'utf8')
        return { ok: true, cleanedPath: cleanPath, keptSections: [] }
      }

      const raw = await fs.readFile(processOutputPath, 'utf8')

      const keptSections: string[] = []
      const lines = raw.split(/\r?\n/)
      const header: string[] = []
      const assistantTexts: string[] = []
      const fileWrites: string[] = []
      let summaryBlock: string[] = []
      let inStream = false
      let inSummary = false

      for (const line of lines) {
        if (!inStream && line.includes('---- STREAM ----')) {
          inStream = true
          continue
        }
        if (!inSummary && line.includes('---- SUMMARY ----')) {
          inSummary = true
          continue
        }
        if (!inStream && !inSummary) {
          // Keep minimal header: Task/CWD/Dirs/Prompt and prompt body
          if (/^(Task:|CWD:|TaskDir:|ParentDir:|LandmarkDir:|Prompt:|你正在该项目目录下工作|请严格在项目根目录执行|上下文与资料阅读要求|如需创建\/修改文件)/.test(line)) {
            header.push(line)
          } else if (line.startsWith('- ')) {
            header.push(line)
          }
          continue
        }
        if (inStream && !inSummary) {
          // Lines are like: [ts] [type] {json}
          const idx = line.indexOf('{')
          if (idx === -1) continue
          const jsonStr = line.slice(idx)
          try {
            const obj = JSON.parse(jsonStr)
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
          continue
        }
        if (inSummary) {
          // Stop if process end marker reached
          if (/==== Process end/.test(line)) break
          summaryBlock.push(line)
        }
      }

      const out: string[] = []
      out.push('# 任务执行记录（精简版）')
      out.push('')
      if (task.description) {
        out.push('## 任务描述')
        out.push(task.description.trim())
        out.push('')
      }
      if (header.length) {
        out.push('## 上下文')
        out.push(...header)
        out.push('')
      }
      if (assistantTexts.length) {
        out.push('## AI 关键说明')
        // 去重
        const seen = new Set<string>()
        for (const t of assistantTexts) {
          if (seen.has(t)) continue
          seen.add(t)
          out.push(`- ${t}`)
        }
        out.push('')
        keptSections.push('assistantTexts')
      }
      if (fileWrites.length) {
        out.push('## 文件写入')
        const rel = (p: string) => path.isAbsolute(p) ? path.relative(cwd, p) : p
        for (const f of fileWrites) out.push(`- ${rel(f)}`)
        out.push('')
        keptSections.push('fileWrites')
      }
      if (summaryBlock.length) {
        out.push('## 执行总结')
        out.push(...summaryBlock)
        out.push('')
        keptSections.push('summary')
      }

      const cleaned = out.join('\n')
      await fs.writeFile(cleanPath, cleaned, 'utf8')
      return { ok: true, cleanedPath: cleanPath, keptSections }
    }),
})
