import { z } from "zod";

const timeSchema = z.string().regex(/^\d{2}:\d{2}$/);

const scheduleFields = {
  workStartTime: timeSchema.optional(),
  workEndTime: timeSchema.optional(),
  halfDayThresholdTime: timeSchema.optional(),
  monthlySalary: z.number().min(0).optional(),
};

const scheduleRefineOptions = {
  message:
    "Schedule times must satisfy workStartTime < halfDayThresholdTime < workEndTime",
};

function isValidSchedule(data: {
  workStartTime?: string | undefined;
  workEndTime?: string | undefined;
  halfDayThresholdTime?: string | undefined;
}): boolean {
  const start = data.workStartTime ?? "09:00";
  const end = data.workEndTime ?? "17:00";
  const half = data.halfDayThresholdTime ?? "11:00";
  return start < half && half < end;
}

export const createTeacherSchema = z
  .object({
    name: z.string().min(1),
    email: z.string().email(),
    password: z.string().min(6),
    employeeId: z.string().min(1).optional(),
    phone: z.string().min(1).optional(),
    ...scheduleFields,
  })
  .refine(isValidSchedule, scheduleRefineOptions);

export const updateTeacherSchema = z
  .object({
    name: z.string().min(1).optional(),
    email: z.string().email().optional(),
    password: z.string().min(6).optional(),
    employeeId: z.string().min(1).nullable().optional(),
    phone: z.string().min(1).nullable().optional(),
    ...scheduleFields,
  })
  .refine((data) => Object.values(data).some((value) => value !== undefined), {
    message: "At least one field must be provided",
  })
  .refine(isValidSchedule, scheduleRefineOptions);

export type CreateTeacherInput = z.infer<typeof createTeacherSchema>;
export type UpdateTeacherInput = z.infer<typeof updateTeacherSchema>;
