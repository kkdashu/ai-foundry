import { NextRequest, NextResponse } from 'next/server'
import { db, projects } from '@/lib/db'
import { eq } from 'drizzle-orm'

export async function DELETE(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { id } = params
    if (!id) {
      return NextResponse.json({ error: 'Missing project id' }, { status: 400 })
    }

    const deleted = await db.delete(projects).where(eq(projects.id, id)).returning()
    if (!deleted || deleted.length === 0) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    return NextResponse.json({ ok: true, project: deleted[0] })
  } catch (error) {
    console.error('Error deleting project:', error)
    return NextResponse.json({ error: 'Failed to delete project' }, { status: 500 })
  }
}

