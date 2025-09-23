This project includes a tRPC scaffold.

To enable it fully, install dependencies and wrap your app with the tRPC + React Query provider.

1) Install packages

pnpm add @trpc/server @trpc/client @trpc/react-query @tanstack/react-query zod

2) Optional: add superjson if you want rich data transformers

pnpm add superjson

3) The HTTP handler is exposed at /api/trpc via app/api/trpc/[trpc]/route.ts
   It dynamically imports tRPC so the app keeps working before deps are installed.

4) Server routers live under server/routers. Example: projects.list

5) To use in the UI, create a client in lib/trpc/client.ts (see tRPC docs) and wrap providers in app/layout.tsx.

