import { promises as fs } from 'fs'
import * as path from 'path'

async function ensureDir(dir: string) {
  await fs.mkdir(dir, { recursive: true })
}

export async function ensureProjectRoot(projectPath: string) {
  const dot = path.join(projectPath, '.project')
  await ensureDir(dot)
  return dot
}

export async function ensureLandmarkDir(projectPath: string, landmarkId: string) {
  const root = await ensureProjectRoot(projectPath)
  const lm = path.join(root, landmarkId)
  await ensureDir(lm)
  return lm
}

export async function ensureTaskDir(projectPath: string, landmarkId: string, taskId: string) {
  const lm = await ensureLandmarkDir(projectPath, landmarkId)
  const task = path.join(lm, taskId)
  await ensureDir(task)
  return task
}

