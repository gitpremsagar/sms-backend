import { z } from "zod";
import { StudentAttendanceStatus } from "@prisma/client";

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const entrySchema = z.object({
  studentId: z.string().min(1),
  status: z.nativeEnum(StudentAttendanceStatus),
});

export const registerQuerySchema = z.object({
  classId: z.string().min(1),
  year: z.coerce.number().int().min(2000).max(2100),
  month: z.coerce.number().int().min(1).max(12),
});

export const monthYearQuerySchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100),
  month: z.coerce.number().int().min(1).max(12),
});

export const dailyQuerySchema = z.object({
  classId: z.string().min(1),
  date: dateSchema,
});

export const dailyDateQuerySchema = z.object({
  date: dateSchema,
});

export const studentDateSchema = z.object({
  studentId: z.string().min(1),
  date: dateSchema,
});

export const markSchema = studentDateSchema.extend({
  classId: z.string().min(1),
  status: z.nativeEnum(StudentAttendanceStatus),
});

export const saveDailyBodySchema = z.object({
  date: dateSchema,
  entries: z.array(entrySchema).min(1),
});

export const saveDailySchema = saveDailyBodySchema.extend({
  classId: z.string().min(1),
});

export const undoQuerySchema = z.object({
  studentId: z.string().min(1),
  date: dateSchema,
});

export type RegisterQuery = z.infer<typeof registerQuerySchema>;
export type DailyQuery = z.infer<typeof dailyQuerySchema>;
export type MarkInput = z.infer<typeof markSchema>;
export type SaveDailyInput = z.infer<typeof saveDailySchema>;
