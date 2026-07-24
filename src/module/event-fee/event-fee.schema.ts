import { EventFeeKind, FeePaymentStatus } from "@prisma/client";
import { z } from "zod";

const objectIdSchema = z.string().regex(/^[a-f\d]{24}$/i, "Invalid id");

const classRateSchema = z.object({
  classId: objectIdSchema,
  amount: z.coerce.number().min(0),
});

export const eventFeeListQuerySchema = z.object({
  financialYearStart: z.coerce.number().int().min(2000).max(2100),
});

export const eventFeeRegisterQuerySchema = z.object({
  financialYearStart: z.coerce.number().int().min(2000).max(2100),
  eventFeeId: objectIdSchema.optional(),
  classId: objectIdSchema.optional(),
});

export const eventFeeReportQuerySchema = z.object({
  financialYearStart: z.coerce.number().int().min(2000).max(2100),
});

const dueDateSchema = z
  .union([
    z.string().datetime(),
    z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    z.literal(""),
    z.null(),
  ])
  .optional();

export const createEventFeeSchema = z.object({
  title: z.string().trim().min(1).max(200),
  kind: z.nativeEnum(EventFeeKind),
  financialYearStart: z.coerce.number().int().min(2000).max(2100),
  dueDate: dueDateSchema,
  notes: z.string().trim().max(2000).nullable().optional(),
  classRates: z.array(classRateSchema).min(1),
});

export const updateEventFeeSchema = createEventFeeSchema;

export const updateEventFeePaymentSchema = z.object({
  eventFeeId: objectIdSchema,
  studentId: objectIdSchema,
  status: z.enum([FeePaymentStatus.PAID, FeePaymentStatus.UNPAID]),
});

export type EventFeeListQuery = z.infer<typeof eventFeeListQuerySchema>;
export type EventFeeRegisterQuery = z.infer<typeof eventFeeRegisterQuerySchema>;
export type EventFeeReportQuery = z.infer<typeof eventFeeReportQuerySchema>;
export type CreateEventFeeInput = z.infer<typeof createEventFeeSchema>;
export type UpdateEventFeeInput = z.infer<typeof updateEventFeeSchema>;
export type UpdateEventFeePaymentInput = z.infer<
  typeof updateEventFeePaymentSchema
>;
