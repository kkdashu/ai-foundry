import { createTRPCRouter, publicProcedure } from '@/server/trpc'
import { db, landmarks } from '@/lib/db'
import { z } from 'zod'
import { eq, and } from 'drizzle-orm'
import { LandmarkSchema, NewLandmarkSchema } from '@/lib/api/schemas'
import { getLocalPath } from '@/lib/local/registry'
import { ensureLandmarkDir } from '@/lib/local/project-fs'

export const landmarksRouter = createTRPCRouter({
  listByProject: publicProcedure
    .input(z.object({ projectId: z.string().uuid() }))
    .output(z.array(LandmarkSchema))
    .query(async ({ input }) => {
      const rows = await db.select().from(landmarks).where(eq(landmarks.projectId, input.projectId)).orderBy(landmarks.createdAt)
      return rows as any
    }),

  create: publicProcedure
    .input(NewLandmarkSchema)
    .output(LandmarkSchema)
    .mutation(async ({ input }) => {
      const inserted = await db.insert(landmarks).values({
        projectId: input.projectId,
        name: input.name,
        completedAt: (input as any).completedAt ?? null,
      }).returning()
      const row = inserted[0]
      try {
        const cwd = await getLocalPath(row.projectId)
        if (cwd) await ensureLandmarkDir(cwd, row.id)
      } catch (err) {
        console.warn('ensureLandmarkDir failed:', (err as any)?.message || err)
      }
      return row as any
    }),

  update: publicProcedure
    .input(z.object({ id: z.string().uuid(), name: z.string().optional(), completedAt: z.coerce.date().nullable().optional() }))
    .output(LandmarkSchema)
    .mutation(async ({ input }) => {
      const updates: any = {}
      if (typeof input.name === 'string') updates.name = input.name
      if ('completedAt' in input) updates.completedAt = input.completedAt ?? null
      updates.updatedAt = new Date()
      const updated = await db.update(landmarks).set(updates).where(eq(landmarks.id, input.id)).returning()
      if (!updated || updated.length === 0) throw new Error('Landmark not found')
      return updated[0] as any
    }),

  delete: publicProcedure
    .input(z.object({ id: z.string().uuid(), projectId: z.string().uuid().optional() }))
    .output(z.object({ ok: z.boolean() }))
    .mutation(async ({ input }) => {
      const where = input.projectId ? and(eq(landmarks.id, input.id), eq(landmarks.projectId, input.projectId)) : eq(landmarks.id, input.id)
      const deleted = await db.delete(landmarks).where(where).returning()
      if (!deleted || deleted.length === 0) throw new Error('Landmark not found')
      return { ok: true }
    }),
})
