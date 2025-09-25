import { pgTable, uuid, varchar, text, timestamp, jsonb, type AnyPgColumn } from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'

export const projects = pgTable('projects', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description').notNull(),
  repositoryUrl: varchar('repository_url', { length: 500 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export const landmarks = pgTable('landmarks', {
  id: uuid('id').defaultRandom().primaryKey(),
  projectId: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  completedAt: timestamp('completed_at'),
})

export const tasks = pgTable('tasks', {
  id: uuid('id').defaultRandom().primaryKey(),
  projectId: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  landmarkId: uuid('landmark_id').references(() => landmarks.id, { onDelete: 'set null' }),
  // 前置任务：同表自引用，可为 null
  predecessorId: uuid('predecessor_id').references(((): AnyPgColumn => tasks.id), { onDelete: 'set null' }),
  description: text('description').notNull(),
  status: varchar('status', { length: 50 }).notNull().default('pending'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export const comments = pgTable('comments', {
  id: uuid('id').defaultRandom().primaryKey(),
  taskId: uuid('task_id').notNull().references(() => tasks.id, { onDelete: 'cascade' }),
  author: varchar('author', { length: 64 }).notNull().default('ClaudeCode'),
  summary: text('summary').notNull(),
  content: jsonb('content').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export const projectsRelations = relations(projects, ({ many }) => ({
  tasks: many(tasks),
  landmarks: many(landmarks),
}))

export const tasksRelations = relations(tasks, ({ one, many }) => ({
  project: one(projects, {
    fields: [tasks.projectId],
    references: [projects.id],
  }),
  landmark: one(landmarks, {
    fields: [tasks.landmarkId],
    references: [landmarks.id],
  }),
  // 自引用关系：前置任务 与 后续任务
  predecessor: one(tasks, {
    fields: [tasks.predecessorId],
    references: [tasks.id],
    relationName: 'predecessor',
  }),
  successors: many(tasks, { relationName: 'predecessor' }),
  comments: many(comments),
}))

export const landmarksRelations = relations(landmarks, ({ one, many }) => ({
  project: one(projects, {
    fields: [landmarks.projectId],
    references: [projects.id],
  }),
  tasks: many(tasks),
}))

export type Project = typeof projects.$inferSelect
export type NewProject = typeof projects.$inferInsert
export type Landmark = typeof landmarks.$inferSelect
export type NewLandmark = typeof landmarks.$inferInsert
export type Task = typeof tasks.$inferSelect
export type NewTask = typeof tasks.$inferInsert
export type Comment = typeof comments.$inferSelect
export type NewComment = typeof comments.$inferInsert
