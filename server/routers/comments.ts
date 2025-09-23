import { createTRPCRouter, publicProcedure } from '@/server/trpc'
import { db, comments } from '@/lib/db'
import { CommentSchema } from '@/lib/api/schemas'
import { z } from 'zod'
import { eq } from 'drizzle-orm'

export const commentsRouter = createTRPCRouter({
  listByTask: publicProcedure
    .input(z.object({ taskId: z.string().uuid() }))
    .output(z.array(CommentSchema))
    .query(async ({ input }) => {
      const rows = await db.select().from(comments).where(eq(comments.taskId, input.taskId)).orderBy(comments.createdAt)
      return rows as any
    }),
})

