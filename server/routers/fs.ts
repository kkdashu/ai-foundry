import { createTRPCRouter, publicProcedure } from '@/server/trpc'
import { TRPCError } from '@trpc/server'
import { z } from 'zod'
import { promises as fs } from 'fs'
import * as path from 'path'
import { getLocalPath, validateDirectoryExists } from '@/lib/local/registry'

const DEFAULT_IGNORES = new Set(['.git', 'node_modules', '.next', 'dist', 'build', '.turbo'])

async function getBoundBase(projectId: string) {
  const base = await getLocalPath(projectId)
  if (!base) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Project not bound to local path' })
  const check = await validateDirectoryExists(base)
  if (!check.ok || !check.path) throw new TRPCError({ code: 'BAD_REQUEST', message: `Invalid base path: ${check.reason || 'unknown'}` })
  // realpath to resolve symlinks
  const real = await fs.realpath(check.path)
  return real
}

function toPosixRel(p: string) {
  return p.split(path.sep).join('/')
}

async function ensureInside(baseReal: string, targetAbs: string) {
  const targetReal = await fs.realpath(targetAbs).catch(async (err: any) => {
    // If the path does not exist yet (e.g., listing a directory that exists, or resolving a file that exists)
    // For listing we will stat the directory; if realpath fails for non-existent, fallback to resolved abs
    if (err?.code === 'ENOENT') return path.resolve(targetAbs)
    throw err
  })
  const normBase = baseReal.endsWith(path.sep) ? baseReal : baseReal + path.sep
  if (targetReal !== baseReal && !targetReal.startsWith(normBase)) {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Path escapes base directory' })
  }
  return targetReal
}

async function hasChildren(dir: string): Promise<boolean> {
  try {
    const dh = await fs.opendir(dir)
    for await (const ent of dh) {
      if (DEFAULT_IGNORES.has(ent.name)) continue
      // Show hidden files; we only use ignore list
      return true
    }
    return false
  } catch {
    return false
  }
}

export const fsRouter = createTRPCRouter({
  list: publicProcedure
    .input(z.object({ projectId: z.string().uuid(), rel: z.string().optional().default('') }))
    .output(z.object({
      rel: z.string(),
      items: z.array(z.object({
        name: z.string(),
        rel: z.string(),
        type: z.union([z.literal('dir'), z.literal('file')]),
        size: z.number().optional(),
        mtime: z.number().optional(),
        hasChildren: z.boolean().optional(),
      })),
    }))
    .query(async ({ input }) => {
      const baseReal = await getBoundBase(input.projectId)
      const rel = input.rel?.trim() || ''
      const targetAbs = path.resolve(baseReal, rel)
      await ensureInside(baseReal, targetAbs)

      let st: any
      try {
        st = await fs.stat(targetAbs)
      } catch (err: any) {
        if (err?.code === 'ENOENT') {
          // Directory was removed/renamed meanwhile — return empty list gracefully
          return { rel: toPosixRel(rel), items: [] }
        }
        throw new TRPCError({ code: 'BAD_REQUEST', message: `Target not accessible: ${err?.message || 'unknown'}` })
      }
      if (!st.isDirectory()) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Not a directory' })
      }

      const entries = await fs.readdir(targetAbs, { withFileTypes: true }).catch((err) => {
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: `Failed to read directory: ${err?.message || 'unknown'}` })
      })

      const items: Array<{ name: string; rel: string; type: 'dir' | 'file'; size?: number; mtime?: number; hasChildren?: boolean }> = []
      for (const ent of entries) {
        const name = ent.name
        if (DEFAULT_IGNORES.has(name)) continue
        const childAbs = path.resolve(targetAbs, name)
        const childRel = rel ? toPosixRel(path.join(rel, name)) : toPosixRel(name)
        try {
          if (ent.isDirectory()) {
            const hc = await hasChildren(childAbs)
            const statDir = await fs.stat(childAbs).catch(() => null)
            items.push({ name, rel: childRel, type: 'dir', mtime: statDir ? Math.floor(statDir.mtimeMs) : undefined, hasChildren: hc })
          } else if (ent.isFile()) {
            const stFile = await fs.stat(childAbs)
            items.push({ name, rel: childRel, type: 'file', size: stFile.size, mtime: Math.floor(stFile.mtimeMs) })
          } else {
            // skip symlinks and others for now
          }
        } catch {
          // ignore unreadable entries
        }
      }

      // Sort: dirs first, then files; lexicographically
      items.sort((a, b) => {
        if (a.type !== b.type) return a.type === 'dir' ? -1 : 1
        return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
      })

      return { rel: toPosixRel(rel), items }
    }),

  read: publicProcedure
    .input(z.object({ projectId: z.string().uuid(), rel: z.string().min(1), maxBytes: z.number().int().positive().max(5 * 1024 * 1024).optional() }))
    .output(z.object({ rel: z.string(), content: z.string(), size: z.number(), truncated: z.boolean() }))
    .query(async ({ input }) => {
      const baseReal = await getBoundBase(input.projectId)
      const rel = input.rel
      const targetAbs = path.resolve(baseReal, rel)
      await ensureInside(baseReal, targetAbs)

      const st = await fs.stat(targetAbs).catch((err) => {
        throw new TRPCError({ code: 'BAD_REQUEST', message: `File not accessible: ${err?.message || 'unknown'}` })
      })
      if (!st.isFile()) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Not a file' })

      const maxBytes = input.maxBytes ?? 1024 * 1024 // 1MB
      const size = st.size
      const toRead = Math.min(size, maxBytes)

      const buf = await fs.readFile(targetAbs).catch((err) => {
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: `Failed to read file: ${err?.message || 'unknown'}` })
      })

      // Basic binary check: zero byte present
      const head = buf.subarray(0, Math.min(buf.length, 4096))
      for (let i = 0; i < head.length; i++) {
        if (head[i] === 0) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Binary file preview not supported' })
      }

      const content = buf.subarray(0, toRead).toString('utf8')
      const truncated = size > toRead
      return { rel: toPosixRel(rel), content, size, truncated }
    }),

  image: publicProcedure
    .input(z.object({ projectId: z.string().uuid(), rel: z.string().min(1), maxBytes: z.number().int().positive().max(20 * 1024 * 1024).optional() }))
    .output(z.object({ rel: z.string(), contentType: z.string(), dataUrl: z.string(), size: z.number() }))
    .query(async ({ input }) => {
      const baseReal = await getBoundBase(input.projectId)
      const rel = input.rel
      const targetAbs = path.resolve(baseReal, rel)
      await ensureInside(baseReal, targetAbs)

      const st = await fs.stat(targetAbs).catch((err) => {
        throw new TRPCError({ code: 'BAD_REQUEST', message: `File not accessible: ${err?.message || 'unknown'}` })
      })
      if (!st.isFile()) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Not a file' })

      const ext = (rel.split('.').pop() || '').toLowerCase()
      const map: Record<string, string> = {
        png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp',
        svg: 'image/svg+xml', bmp: 'image/bmp', ico: 'image/x-icon', tif: 'image/tiff', tiff: 'image/tiff', avif: 'image/avif',
        heic: 'image/heic', heif: 'image/heif', jfif: 'image/jpeg'
      }
      const contentType = map[ext]
      if (!contentType) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Unsupported image type' })

      const size = st.size
      const maxBytes = input.maxBytes ?? 10 * 1024 * 1024 // 10MB
      if (size > maxBytes) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: `Image too large (>${Math.floor(maxBytes / (1024 * 1024))}MB)` })
      }

      const buf = await fs.readFile(targetAbs).catch((err) => {
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: `Failed to read file: ${err?.message || 'unknown'}` })
      })

      const base64 = buf.toString('base64')
      const dataUrl = `data:${contentType};base64,${base64}`
      return { rel: toPosixRel(rel), contentType, dataUrl, size }
    }),

  mkdir: publicProcedure
    .input(z.object({ projectId: z.string().uuid(), parentRel: z.string().optional().default(''), name: z.string().min(1).max(128) }))
    .output(z.object({ ok: z.literal(true), rel: z.string(), name: z.string() }))
    .mutation(async ({ input }) => {
      const baseReal = await getBoundBase(input.projectId)
      const parentRel = input.parentRel?.trim() || ''
      // Validate folder name: no path separators, trim spaces
      const rawName = input.name.trim()
      if (!rawName) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Name cannot be empty' })
      if (rawName.includes('/') || rawName.includes('\\')) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Name cannot contain path separators' })
      }
      const parentAbs = path.resolve(baseReal, parentRel)
      await ensureInside(baseReal, parentAbs)
      const st = await fs.stat(parentAbs).catch((err) => {
        throw new TRPCError({ code: 'BAD_REQUEST', message: `Parent not accessible: ${err?.message || 'unknown'}` })
      })
      if (!st.isDirectory()) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Parent is not a directory' })
      const childAbs = path.join(parentAbs, rawName)
      await ensureInside(baseReal, childAbs)
      // Must not exist
      const exists = await fs.stat(childAbs).then(() => true).catch((e: any) => e?.code === 'ENOENT' ? false : Promise.reject(e))
      if (exists) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Directory already exists' })
      await fs.mkdir(childAbs)
      const childRel = parentRel ? toPosixRel(path.join(parentRel, rawName)) : toPosixRel(rawName)
      return { ok: true as const, rel: childRel, name: rawName }
    }),

  createFile: publicProcedure
    .input(z.object({ projectId: z.string().uuid(), parentRel: z.string().optional().default(''), name: z.string().min(1).max(256), content: z.string().optional().default('') }))
    .output(z.object({ ok: z.literal(true), rel: z.string(), name: z.string(), size: z.number() }))
    .mutation(async ({ input }) => {
      const baseReal = await getBoundBase(input.projectId)
      const parentRel = input.parentRel?.trim() || ''
      const rawName = input.name.trim()
      if (!rawName) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Name cannot be empty' })
      if (rawName.includes('/') || rawName.includes('\\')) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Name cannot contain path separators' })
      }
      const parentAbs = path.resolve(baseReal, parentRel)
      await ensureInside(baseReal, parentAbs)
      const st = await fs.stat(parentAbs).catch((err) => {
        throw new TRPCError({ code: 'BAD_REQUEST', message: `Parent not accessible: ${err?.message || 'unknown'}` })
      })
      if (!st.isDirectory()) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Parent is not a directory' })
      const fileAbs = path.join(parentAbs, rawName)
      await ensureInside(baseReal, fileAbs)
      const exists = await fs.stat(fileAbs).then(() => true).catch((e: any) => e?.code === 'ENOENT' ? false : Promise.reject(e))
      if (exists) throw new TRPCError({ code: 'BAD_REQUEST', message: 'File already exists' })
      const content = input.content ?? ''
      await fs.writeFile(fileAbs, content, 'utf8')
      const rel = parentRel ? toPosixRel(path.join(parentRel, rawName)) : toPosixRel(rawName)
      return { ok: true as const, rel, name: rawName, size: Buffer.byteLength(content, 'utf8') }
    }),

  rename: publicProcedure
    .input(z.object({ projectId: z.string().uuid(), rel: z.string().min(1), newName: z.string().min(1).max(256) }))
    .output(z.object({ ok: z.literal(true), oldRel: z.string(), newRel: z.string() }))
    .mutation(async ({ input }) => {
      const baseReal = await getBoundBase(input.projectId)
      const rel = input.rel
      const oldAbs = path.resolve(baseReal, rel)
      await ensureInside(baseReal, oldAbs)
      const st = await fs.stat(oldAbs).catch((err) => {
        throw new TRPCError({ code: 'BAD_REQUEST', message: `Path not accessible: ${err?.message || 'unknown'}` })
      })
      const newName = input.newName.trim()
      if (!newName) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Name cannot be empty' })
      if (newName.includes('/') || newName.includes('\\')) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Name cannot contain path separators' })
      const parentAbs = path.dirname(oldAbs)
      const newAbs = path.join(parentAbs, newName)
      await ensureInside(baseReal, newAbs)
      const exists = await fs.stat(newAbs).then(() => true).catch((e: any) => e?.code === 'ENOENT' ? false : Promise.reject(e))
      if (exists) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Target name already exists' })
      await fs.rename(oldAbs, newAbs)
      const oldRelPosix = toPosixRel(rel)
      const parentRel = toPosixRel(path.relative(baseReal, parentAbs))
      const newRel = parentRel ? toPosixRel(path.join(parentRel, newName)) : toPosixRel(newName)
      return { ok: true as const, oldRel: oldRelPosix, newRel }
    }),

  remove: publicProcedure
    .input(z.object({ projectId: z.string().uuid(), rel: z.string().min(1), recursive: z.boolean().optional().default(false) }))
    .output(z.object({ ok: z.literal(true) }))
    .mutation(async ({ input }) => {
      const baseReal = await getBoundBase(input.projectId)
      const rel = input.rel
      const targetAbs = path.resolve(baseReal, rel)
      await ensureInside(baseReal, targetAbs)
      const st = await fs.stat(targetAbs).catch((err) => {
        throw new TRPCError({ code: 'BAD_REQUEST', message: `Path not accessible: ${err?.message || 'unknown'}` })
      })
      if (st.isDirectory()) {
        if (!input.recursive) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Directory deletion requires recursive=true' })
        await fs.rm(targetAbs, { recursive: true, force: false })
      } else if (st.isFile()) {
        await fs.unlink(targetAbs)
      } else {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Unsupported file type' })
      }
      return { ok: true as const }
    }),

  move: publicProcedure
    .input(z.object({ projectId: z.string().uuid(), srcRel: z.string().min(1), destParentRel: z.string().optional().default(''), newName: z.string().optional() }))
    .output(z.object({ ok: z.literal(true), oldRel: z.string(), newRel: z.string() }))
    .mutation(async ({ input }) => {
      const baseReal = await getBoundBase(input.projectId)
      const srcRel = input.srcRel
      const destParentRel = input.destParentRel?.trim() || ''
      const oldAbs = path.resolve(baseReal, srcRel)
      await ensureInside(baseReal, oldAbs)
      const st = await fs.stat(oldAbs).catch((err) => {
        throw new TRPCError({ code: 'BAD_REQUEST', message: `Source not accessible: ${err?.message || 'unknown'}` })
      })
      const name = input.newName?.trim() || path.basename(srcRel)
      if (!name) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Name cannot be empty' })
      if (name.includes('/') || name.includes('\\')) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Name cannot contain path separators' })
      const destParentAbs = path.resolve(baseReal, destParentRel)
      await ensureInside(baseReal, destParentAbs)
      const stParent = await fs.stat(destParentAbs).catch((err) => {
        throw new TRPCError({ code: 'BAD_REQUEST', message: `Destination not accessible: ${err?.message || 'unknown'}` })
      })
      if (!stParent.isDirectory()) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Destination parent is not a directory' })
      // prevent moving a directory into itself or its descendant
      if (st.isDirectory()) {
        const oldReal = await fs.realpath(oldAbs)
        const destParentReal = await fs.realpath(destParentAbs)
        const normOld = oldReal.endsWith(path.sep) ? oldReal : oldReal + path.sep
        if (destParentReal === oldReal || destParentReal.startsWith(normOld)) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'Cannot move a directory into itself or its subdirectory' })
        }
      }
      const newAbs = path.join(destParentAbs, name)
      await ensureInside(baseReal, newAbs)
      const exists = await fs.stat(newAbs).then(() => true).catch((e: any) => e?.code === 'ENOENT' ? false : Promise.reject(e))
      if (exists) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Target already exists' })
      await fs.rename(oldAbs, newAbs)
      const parentRel = toPosixRel(destParentRel)
      const newRel = parentRel ? toPosixRel(path.join(parentRel, name)) : toPosixRel(name)
      return { ok: true as const, oldRel: toPosixRel(srcRel), newRel }
    }),
})

export type FsRouter = typeof fsRouter
