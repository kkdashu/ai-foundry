// tRPC setup. Note: requires @trpc/server to be installed to be active.
// Files in this folder are imported dynamically by the /api/trpc route to avoid
// breaking the app when tRPC dependencies are not yet installed.

import type { NextRequest } from 'next/server'
import { initTRPC } from '@trpc/server'

export type TRPCContext = {
  req: NextRequest
}

export async function createTRPCContext(opts: { req: NextRequest }): Promise<TRPCContext> {
  return { req: opts.req }
}

export const t = initTRPC.context<TRPCContext>().create({})
export const createTRPCRouter = t.router
export const publicProcedure = t.procedure

