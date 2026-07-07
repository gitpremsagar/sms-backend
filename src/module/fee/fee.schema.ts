import { z } from "zod";
import { FY_MONTHS } from "./fee.financial-year.js";

const fyMonthSchema = z.coerce
  .number()
  .int()
  .refine((value) => FY_MONTHS.includes(value as (typeof FY_MONTHS)[number]), {
    message: "Invalid financial year month",
  });

export const feeRegisterQuerySchema = z.object({
  financialYearStart: z.coerce.number().int().min(2000).max(2100),
  classId: z.string().min(1).optional(),
});

export const feeReportQuerySchema = z.object({
  financialYearStart: z.coerce.number().int().min(2000).max(2100),
});

export const updateFeePaymentSchema = z.object({
  studentId: z.string().min(1),
  financialYearStart: z.coerce.number().int().min(2000).max(2100),
  month: fyMonthSchema,
  amount: z.coerce.number().min(0),
});

export type FeeRegisterQuery = z.infer<typeof feeRegisterQuerySchema>;
export type FeeReportQuery = z.infer<typeof feeReportQuerySchema>;
export type UpdateFeePaymentInput = z.infer<typeof updateFeePaymentSchema>;
