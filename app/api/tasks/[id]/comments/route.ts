import { NextRequest, NextResponse } from 'next/server'
import { db, comments } from '@/lib/db'
import { eq } from 'drizzle-orm'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const rows = await db
      .select()
      .from(comments)
      .where(eq(comments.taskId, id))
      .orderBy(comments.createdAt)
    return NextResponse.json(rows)
  } catch (err) {
    console.error('Fetch comments error:', err)
    return NextResponse.json({ error: 'Failed to fetch comments' }, { status: 500 })
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await req.json().catch(() => null)
    if (!body || !body.summary || !body.content) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
    }
    const row = await db
      .insert(comments)
      .values({ taskId: id, author: body.author || 'ClaudeCode', summary: body.summary, content: body.content })
      .returning()
    return NextResponse.json(row[0])
  } catch (err) {
    console.error('Create comment error:', err)
    return NextResponse.json({ error: 'Failed to create comment' }, { status: 500 })
  }
}

