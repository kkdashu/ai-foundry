import { z } from 'zod'

export const ProjectSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  description: z.string(),
  repositoryUrl: z.string().url().nullable().optional(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
})

export const NewProjectSchema = z.object({
  name: z.string().min(1),
  description: z.string().min(1),
  // Allow empty string, undefined, or null; otherwise must be a valid URL
  repositoryUrl: z.union([z.string().url(), z.literal('')]).optional().nullable(),
})

export const TaskSchema = z.object({
  id: z.string().uuid(),
  projectId: z.string().uuid(),
  landmarkId: z.string().uuid().nullable().optional(),
  predecessorId: z.string().uuid().nullable().optional(),
  description: z.string(),
  status: z.string(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
})

export const NewTaskSchema = z.object({
  projectId: z.string().uuid(),
  description: z.string().min(1),
  status: z.string().optional(),
  landmarkId: z.string().uuid().optional(),
  predecessorId: z.string().uuid().optional(),
})

export const CommentSchema = z.object({
  id: z.string().uuid(),
  taskId: z.string().uuid(),
  author: z.string(),
  summary: z.string(),
  content: z.any(),
  createdAt: z.coerce.date(),
})

export const ApiErrorSchema = z.object({ error: z.string() })

// Landmark
export const LandmarkSchema = z.object({
  id: z.string().uuid(),
  projectId: z.string().uuid(),
  name: z.string(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
  completedAt: z.coerce.date().nullable().optional(),
})

export const NewLandmarkSchema = z.object({
  projectId: z.string().uuid(),
  name: z.string().min(1),
  completedAt: z.coerce.date().optional(),
})

export type ProjectDto = z.infer<typeof ProjectSchema>
export type NewProjectDto = z.infer<typeof NewProjectSchema>
export type TaskDto = z.infer<typeof TaskSchema>
export type NewTaskDto = z.infer<typeof NewTaskSchema>
export type CommentDto = z.infer<typeof CommentSchema>
export type ApiErrorDto = z.infer<typeof ApiErrorSchema>
export type LandmarkDto = z.infer<typeof LandmarkSchema>
export type NewLandmarkDto = z.infer<typeof NewLandmarkSchema>
