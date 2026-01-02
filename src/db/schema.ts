import { boolean, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import {
  createInsertSchema,
  createSelectSchema,
  createUpdateSchema,
} from "drizzle-zod";
import { z } from "zod";

/**
 * Todos table schema definition
 *
 * Represents the core data structure for todo items in the application
 */
export const todos = pgTable(`todos`, {
  id: serial(`id`).primaryKey(),
  text: text(`text`).notNull(),
  completed: boolean(`completed`).notNull().default(false),
  created_at: timestamp(`created_at`, { withTimezone: true })
    .notNull()
    .defaultNow(),
  updated_at: timestamp(`updated_at`, { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const selectTodoSchema = createSelectSchema(todos);
export const insertTodoSchema = createInsertSchema(todos);
export const updateTodoSchema = createUpdateSchema(todos);

// Validation functions
export function validateInsertTodo(data: unknown) {
  return insertTodoSchema.pick({ text: true }).parse(data);
}

export function validateUpdateTodo(data: unknown) {
  return updateTodoSchema.parse(data);
}

export type Todo = z.infer<typeof selectTodoSchema>;

/**
 * Diaries table schema definition
 *
 * Represents the core data structure for diary entries with rich text content
 */
export const diaries = pgTable(`diaries`, {
  id: serial(`id`).primaryKey(),
  title: text(`title`).notNull(),
  content: text(`content`), // Rich text HTML content from TenTap editor
  created_at: timestamp(`created_at`, { withTimezone: true })
    .notNull()
    .defaultNow(),
  updated_at: timestamp(`updated_at`, { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const selectDiarySchema = createSelectSchema(diaries);
export const insertDiarySchema = createInsertSchema(diaries);
export const updateDiarySchema = createUpdateSchema(diaries);

// Validation functions
export function validateInsertDiary(data: unknown) {
  return insertDiarySchema.pick({ title: true, content: true }).parse(data);
}

export function validateUpdateDiary(data: unknown) {
  return updateDiarySchema.parse(data);
}

export type Diary = z.infer<typeof selectDiarySchema>;
