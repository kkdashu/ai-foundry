import '@/lib/undici-proxy'
import { tool as createTool } from 'ai'
import { z } from 'zod'
import { db, projects } from '@/lib/db'
import { eq, desc, ilike } from 'drizzle-orm'

export const createProjectTool = createTool({
  description:
    'Create a new project in the database. Use when the user asks to create a project.',
  inputSchema: z.object({
    name: z.string().min(1).describe('Project name.'),
    description: z
      .string()
      .optional()
      .describe('Short description; if omitted, the tool will generate a default.'),
    repositoryUrl: z
      .string()
      .url()
      .optional()
      .describe('Optional repository URL.'),
  }),
  execute: async ({ name, description, repositoryUrl }) => {
    const desc = description?.trim() || `由 AI 助手创建的项目：${name}`

    const inserted = await db
      .insert(projects)
      .values({ name, description: desc, repositoryUrl: repositoryUrl || null })
      .returning()

    const project = inserted?.[0]

    return {
      ok: true,
      project,
      message: `项目已创建：${project?.name}`,
    }
  },
})

export type CreateProjectInput = z.infer<typeof createProjectTool.inputSchema>;

export const deleteProjectTool = createTool({
  description:
    'Delete a project by id or name. Prefer id when available; otherwise the latest project with the given name will be deleted.',
  inputSchema: z
    .object({
      id: z.string().uuid().optional().describe('Project id'),
      name: z.string().optional().describe('Project name'),
    })
    .refine((v) => !!v.id || !!v.name, 'Provide id or name.'),
  execute: async ({ id, name }) => {
    let targetId = id
    let targetProject: any = null

    if (!targetId && name) {
      const rows = await db
        .select()
        .from(projects)
        .where(eq(projects.name, name))
        .orderBy(desc(projects.createdAt))
      if (rows.length === 0) {
        return { ok: false, message: `未找到名称为“${name}”的项目` }
      }
      if (rows.length > 1) {
        return {
          ok: false,
          ambiguous: true,
          count: rows.length,
          candidates: rows.map((r) => ({
            id: r.id,
            name: r.name,
            description: r.description,
            repositoryUrl: r.repositoryUrl,
            createdAt: r.createdAt,
          })),
          message: `存在多个名称为“${name}”的项目，请提供要删除的项目ID。`,
        }
      }
      targetId = rows[0].id
      targetProject = rows[0]
    }

    if (!targetId) return { ok: false, message: '缺少项目 id 或名称' }

    const deleted = await db.delete(projects).where(eq(projects.id, targetId)).returning()
    const project = deleted?.[0] || targetProject

    if (!deleted || deleted.length === 0) {
      return { ok: false, message: '项目不存在或已删除' }
    }

    return {
      ok: true,
      project,
      message: `项目已删除：${project?.name ?? targetId}`,
    }
  },
})

export type DeleteProjectInput = z.infer<typeof deleteProjectTool.inputSchema>;

export const listProjectsTool = createTool({
  description: 'List projects, optionally filtered by name (case-insensitive contains) and limited count.',
  inputSchema: z.object({
    name: z.string().optional().describe('Optional name filter (contains match).'),
    limit: z.number().int().positive().max(100).default(10).describe('Max number of results (default 10).'),
    order: z.enum(['asc', 'desc']).default('desc').describe('Order by creation time.'),
  }),
  execute: async ({ name, limit, order }) => {
    const where = name ? ilike(projects.name, `%${name}%`) : undefined
    const rows = await db
      .select()
      .from(projects)
      .where(where as any)
      .orderBy(order === 'desc' ? desc(projects.createdAt) : projects.createdAt)
      .limit(limit ?? 10)

    return {
      count: rows.length,
      projects: rows.map((r) => ({
        id: r.id,
        name: r.name,
        description: r.description,
        repositoryUrl: r.repositoryUrl,
        createdAt: r.createdAt,
      })),
      message:
        rows.length === 0
          ? name
            ? `未找到匹配名称“${name}”的项目`
            : '未找到项目'
          : `共返回 ${rows.length} 个项目` ,
    }
  },
})

export type ListProjectsInput = z.infer<typeof listProjectsTool.inputSchema>
