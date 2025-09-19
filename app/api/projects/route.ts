import { NextRequest, NextResponse } from 'next/server'
import { db, projects } from '@/lib/db'
import { eq } from 'drizzle-orm'

export async function GET() {
  try {
    const allProjects = await db.select().from(projects).orderBy(projects.createdAt)
    return NextResponse.json(allProjects)
  } catch (error) {
    console.error('Error fetching projects:', error)
    return NextResponse.json({ error: 'Failed to fetch projects' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, description, repositoryUrl } = body

    if (!name || !description) {
      return NextResponse.json({ error: 'Name and description are required' }, { status: 400 })
    }

    const newProject = await db.insert(projects).values({
      name,
      description,
      repositoryUrl: repositoryUrl || null,
    }).returning()

    return NextResponse.json(newProject[0], { status: 201 })
  } catch (error) {
    console.error('Error creating project:', error)
    return NextResponse.json({ error: 'Failed to create project' }, { status: 500 })
  }
}