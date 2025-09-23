import { createTRPCRouter, publicProcedure } from '@/server/trpc'
import { db, projects } from '@/lib/db'
import { ProjectSchema, NewProjectSchema } from '@/lib/api/schemas'
import { z } from 'zod'
import { eq } from 'drizzle-orm'

export const projectsRouter = createTRPCRouter({
  list: publicProcedure
    .input(z.void())
    .output(z.array(ProjectSchema))
    .query(async () => {
      const rows = await db.select().from(projects).orderBy(projects.createdAt)
      return rows as any
    }),

  create: publicProcedure
    .input(NewProjectSchema)
    .output(ProjectSchema)
    .mutation(async ({ input }) => {
      const inserted = await db
        .insert(projects)
        .values({ name: input.name, description: input.description, repositoryUrl: input.repositoryUrl || null })
        .returning()
      return inserted[0] as any
    }),

  getById: publicProcedure
    .input(z.object({ id: z.string().uuid() }))
    .output(ProjectSchema)
    .query(async ({ input }) => {
      const rows = await db.select().from(projects).where(eq(projects.id, input.id)).limit(1)
      if (!rows || rows.length === 0) throw new Error('Project not found')
      return rows[0] as any
    }),

  delete: publicProcedure
    .input(z.object({ id: z.string().uuid() }))
    .output(z.object({ ok: z.boolean() }))
    .mutation(async ({ input }) => {
      const deleted = await db.delete(projects).where(eq(projects.id, input.id)).returning()
      if (!deleted || deleted.length === 0) throw new Error('Project not found')
      return { ok: true }
    }),
})
