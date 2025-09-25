// tRPC Next.js route (App Router).
// Note: This file dynamically imports tRPC at request time so that the app
// keeps working even if @trpc/* packages are not yet installed. If the import
// fails, we return 501 with a helpful message.

import type { NextRequest } from 'next/server'

export const runtime = 'nodejs'

async function handler(req: NextRequest) {
  try {
    const [{ fetchRequestHandler }, { appRouter }, { createTRPCContext }] = await Promise.all([
      import('@trpc/server/adapters/fetch'),
      import('@/server/routers/_app'),
      import('@/server/trpc'),
    ])

    return fetchRequestHandler({
      endpoint: '/api/trpc',
      router: appRouter,
      req,
      createContext: () => createTRPCContext({ req }),
      onError({ error }) {
        console.error('[tRPC] request error:', error)
      },
    })
  } catch (err: any) {
    const msg = err?.message || String(err)
    if (msg?.includes("Cannot find module '@trpc")) {
      return new Response(
        'tRPC packages are not installed. Run: pnpm add @trpc/server @trpc/client @trpc/react-query @tanstack/react-query zod',
        { status: 501 }
      )
    }
    console.error('tRPC route error:', err)
    return new Response('Internal error', { status: 500 })
  }
}

export { handler as GET, handler as POST }

