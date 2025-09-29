import { createTRPCRouter, publicProcedure } from '@/server/trpc'
import { db, projects, landmarks } from '@/lib/db'
import { ProjectSchema, NewProjectSchema } from '@/lib/api/schemas'
import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { autoBindNewProject, getLocalPath } from '@/lib/local/registry'
import { ensureLandmarkDir } from '@/lib/local/project-fs'

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
      const created = inserted[0] as any
      // Best-effort: auto-bind a local directory for newly created project
      try { await autoBindNewProject(created.id, created.name) } catch {}

      // Best-effort: create a default landmark "v1.0"
      try {
        const lmInserted = await db
          .insert(landmarks)
          .values({ projectId: created.id, name: 'v1.0' })
          .returning()
        const lm = lmInserted?.[0]
        if (lm) {
          try {
            const cwd = await getLocalPath(created.id)
            if (cwd) await ensureLandmarkDir(cwd, lm.id)
          } catch {}
        }
      } catch {}
      return created
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
