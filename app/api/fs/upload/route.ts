import { NextRequest, NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import * as path from 'path'
import { getLocalPath, validateDirectoryExists } from '@/lib/local/registry'

export const runtime = 'nodejs'

async function getBoundBase(projectId: string) {
  const base = await getLocalPath(projectId)
  if (!base) throw new Error('Project not bound to local path')
  const check = await validateDirectoryExists(base)
  if (!check.ok || !check.path) throw new Error(`Invalid base path: ${check.reason || 'unknown'}`)
  return await fs.realpath(check.path)
}

async function ensureInside(baseReal: string, targetAbs: string) {
  const targetReal = path.resolve(targetAbs)
  const normBase = baseReal.endsWith(path.sep) ? baseReal : baseReal + path.sep
  if (targetReal !== baseReal && !targetReal.startsWith(normBase)) {
    throw new Error('Path escapes base directory')
  }
}

function safeName(name: string) {
  const n = name.trim()
  if (!n) throw new Error('Empty name')
  if (n.includes('/') || n.includes('\\')) throw new Error('Name contains path separators')
  return n
}

export async function POST(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const projectId = searchParams.get('projectId')
    const parentRel = (searchParams.get('parentRel') || '').trim()
    if (!projectId) return NextResponse.json({ error: 'Missing projectId' }, { status: 400 })

    const baseReal = await getBoundBase(projectId)
    const parentAbs = path.resolve(baseReal, parentRel)
    await ensureInside(baseReal, parentAbs)
    const st = await fs.stat(parentAbs).catch(() => null)
    if (!st || !st.isDirectory()) return NextResponse.json({ error: 'Parent directory not accessible' }, { status: 400 })

    const form = await req.formData()
    const files = form.getAll('files') as unknown as File[]
    if (!files || files.length === 0) return NextResponse.json({ error: 'No files' }, { status: 400 })

    const results: any[] = []
    for (const f of files) {
      const name = safeName((f as any).name || 'file')
      let dest = path.join(parentAbs, name)
      await ensureInside(baseReal, dest)
      // If exists, append (n)
      let idx = 1
      const { name: baseName, ext } = path.parse(dest)
      while (await fs.stat(dest).then(() => true).catch((e: any) => e?.code === 'ENOENT' ? false : Promise.reject(e))) {
        const alt = baseName + ` (${idx++})` + ext
        dest = path.join(parentAbs, alt)
      }

      // Prefer streaming write
      const stream = (f as any).stream?.()
      if (stream && typeof stream.getReader === 'function') {
        // Convert web stream to Node stream via iteration
        const ws = await fs.open(dest, 'w')
        try {
          const reader = (f as any).stream().getReader()
          let total = 0
          while (true) {
            const { done, value } = await reader.read()
            if (done) break
            if (value) {
              await ws.write(value)
              total += value.length || value.byteLength || 0
            }
          }
          results.push({ name, rel: path.relative(baseReal, dest).split(path.sep).join('/'), size: (f as any).size ?? null })
        } finally {
          await ws.close()
        }
      } else {
        const buf = Buffer.from(await (f as any).arrayBuffer())
        await fs.writeFile(dest, buf)
        results.push({ name, rel: path.relative(baseReal, dest).split(path.sep).join('/'), size: buf.length })
      }
    }

    return NextResponse.json({ ok: true, items: results })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Upload failed' }, { status: 400 })
  }
}

