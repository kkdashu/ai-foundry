import { createTRPCRouter, publicProcedure } from '@/server/trpc'
import { db, tasks, comments } from '@/lib/db'
import { TaskSchema, NewTaskSchema } from '@/lib/api/schemas'
import { z } from 'zod'
import { eq, and } from 'drizzle-orm'
import { getLocalPath } from '@/lib/local/registry'
import { ensureProjectRoot, ensureTaskDir } from '@/lib/local/project-fs'
import type { Options } from '@anthropic-ai/claude-code'
import path from 'path'
import {
  inputWithinCwd,
  ensureTaskPaths,
  getParentTaskDir,
  buildPromptText,
  writeProcessHeader,
  writeProcessFooter,
  executeTask,
  generateSummary,
  writeCleanLog
} from './tasks-helpers'

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

        // Prepare Claude Code options
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

        // Calculate relative paths
        const rel = (p: string | null) => (p ? path.relative(cwd, p) || '.' : null)
        const taskDirRel = rel(taskDir)
        const parentDirRel = rel(parentTaskDir)
        const landmarkDirRel = rel(landmarkDir)

        // Build prompt
        const promptText = buildPromptText(cwd, task.description, taskDirRel, parentDirRel, landmarkDirRel)

        // Prepare output file
        const outputPath = path.join(taskDir, 'process_output')
        await writeProcessHeader(outputPath, taskId, cwd, taskDirRel, parentDirRel, landmarkDirRel, promptText)

        // Execute task
        const { lastResult, sessionId: currentSessionId, events } = await executeTask(promptText, options, outputPath)

        // Generate summary
        const summary = await generateSummary(task.description, cwd, events, lastResult)

        // Write footer
        await writeProcessFooter(outputPath, summary, currentSessionId, lastResult?.total_cost_usd)

        // Save to database
        const content = { prompt: promptText, cwd, result: { sessionId: currentSessionId ?? undefined, usage: lastResult?.usage, totalCost: lastResult?.total_cost_usd }, events }
        await db.insert(comments).values({ taskId, author: 'ClaudeCode', summary, content })
        await db.update(tasks).set({ status: 'completed', updatedAt: new Date() }).where(eq(tasks.id, taskId))

        // Write clean log
        await writeCleanLog(taskDir, cwd, task, taskDirRel, parentDirRel, landmarkDirRel, events, summary)

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
})
