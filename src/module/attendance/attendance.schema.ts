import { z } from "zod";

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const registerQuerySchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100),
  month: z.coerce.number().int().min(1).max(12),
});

export const teacherDateSchema = z.object({
  teacherId: z.string().min(1),
  date: dateSchema,
});

const timeSchema = z.string().regex(/^\d{2}:\d{2}$/);

export const punchSchema = teacherDateSchema.extend({
  time: timeSchema.optional(),
});

export const declareHolidaySchema = z.object({
  date: dateSchema,
  label: z.string().min(1).optional(),
});

export type RegisterQuery = z.infer<typeof registerQuerySchema>;
export type TeacherDateInput = z.infer<typeof teacherDateSchema>;
export type DeclareHolidayInput = z.infer<typeof declareHolidaySchema>;
