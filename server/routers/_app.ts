import { createTRPCRouter } from '@/server/trpc'
import { projectsRouter } from './projects'
import { tasksRouter } from './tasks'
import { commentsRouter } from './comments'
import { localRouter } from './local'
import { landmarksRouter } from './landmarks'
// import { aiRouter } from './ai'

export const appRouter = createTRPCRouter({
  projects: projectsRouter,
  tasks: tasksRouter,
  comments: commentsRouter,
  local: localRouter,
  landmarks: landmarksRouter,
  // ai: aiRouter,
})

export type AppRouter = typeof appRouter
