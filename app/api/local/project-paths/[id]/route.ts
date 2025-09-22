import { NextRequest, NextResponse } from 'next/server'
import { getLocalPath, setLocalPath, removeLocalPath, validateDirectoryExists, getRegistryPath } from '@/lib/local/registry'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    if (!id) return NextResponse.json({ error: 'Missing project id' }, { status: 400 })
    const p = await getLocalPath(id)
    return NextResponse.json({ projectId: id, path: p, registry: getRegistryPath() })
  } catch (err) {
    console.error('GET local project path error:', err)
    return NextResponse.json({ error: 'Failed to read local path' }, { status: 500 })
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await req.json().catch(() => null)
    const rawPath = body?.path
    if (!id || typeof rawPath !== 'string' || rawPath.trim() === '') {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
    }

    const check = await validateDirectoryExists(rawPath)
    if (!check.ok || !check.path) {
      return NextResponse.json({ error: `Path invalid: ${check.reason || 'unknown'}` }, { status: 400 })
    }

    const rec = await setLocalPath(id, check.path)
    return NextResponse.json(rec)
  } catch (err) {
    console.error('PUT local project path error:', err)
    return NextResponse.json({ error: 'Failed to save local path' }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    if (!id) return NextResponse.json({ error: 'Missing project id' }, { status: 400 })
    await removeLocalPath(id)
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('DELETE local project path error:', err)
    return NextResponse.json({ error: 'Failed to delete local path' }, { status: 500 })
  }
}
