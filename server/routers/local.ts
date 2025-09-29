import { createTRPCRouter, publicProcedure } from '@/server/trpc'
import { z } from 'zod'
import { getLocalPath, setLocalPath, removeLocalPath, validateDirectoryExists, getRegistryPath, getProjectRoot } from '@/lib/local/registry'
import { TRPCError } from '@trpc/server'

export const localRouter = createTRPCRouter({
  projectRoot: publicProcedure
    .input(z.void())
    .output(z.object({ projectRoot: z.string() }))
    .query(async () => {
      const root = await getProjectRoot()
      return { projectRoot: root }
    }),
  getPath: publicProcedure
    .input(z.object({ projectId: z.string().uuid() }))
    .output(z.object({ projectId: z.string().uuid(), path: z.string().nullable(), registry: z.string() }))
    .query(async ({ input }) => {
      const p = await getLocalPath(input.projectId)
      return { projectId: input.projectId, path: p, registry: getRegistryPath() }
    }),

  setPath: publicProcedure
    .input(z.object({ projectId: z.string().uuid(), path: z.string().min(1) }))
    .output(z.object({ projectId: z.string().uuid(), path: z.string() }))
    .mutation(async ({ input }) => {
      const check = await validateDirectoryExists(input.path)
      if (!check.ok || !check.path) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: `Path invalid: ${check.reason || 'unknown'}` })
      }
      const rec = await setLocalPath(input.projectId, check.path)
      return { projectId: input.projectId, path: rec.path }
    }),

  removePath: publicProcedure
    .input(z.object({ projectId: z.string().uuid() }))
    .output(z.object({ ok: z.boolean() }))
    .mutation(async ({ input }) => {
      await removeLocalPath(input.projectId)
      return { ok: true }
    }),
})
