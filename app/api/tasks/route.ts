import { NextRequest, NextResponse } from 'next/server'
import { db, tasks } from '@/lib/db'
import { eq } from 'drizzle-orm'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const projectId = searchParams.get('projectId')

    if (!projectId) {
      return NextResponse.json({ error: 'projectId is required' }, { status: 400 })
    }

    const projectTasks = await db.select().from(tasks)
      .where(eq(tasks.projectId, projectId))
      .orderBy(tasks.createdAt)

    return NextResponse.json(projectTasks)
  } catch (error) {
    console.error('Error fetching tasks:', error)
    return NextResponse.json({ error: 'Failed to fetch tasks' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { projectId, description, status = 'pending' } = body

    if (!projectId || !description) {
      return NextResponse.json({ error: 'projectId and description are required' }, { status: 400 })
    }

    const newTask = await db.insert(tasks).values({
      projectId,
      description,
      status,
    }).returning()

    return NextResponse.json(newTask[0], { status: 201 })
  } catch (error) {
    console.error('Error creating task:', error)
    return NextResponse.json({ error: 'Failed to create task' }, { status: 500 })
  }
}