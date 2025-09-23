"use client"

import { createTRPCReact } from '@trpc/react-query'
import type { AppRouter } from '@/server/routers/_app'
import { httpBatchLink } from '@trpc/client'

export const api = createTRPCReact<AppRouter>()

export function createTrpcClient() {
  return api.createClient({
    links: [
      httpBatchLink({ url: '/api/trpc' }),
    ],
  })
}

