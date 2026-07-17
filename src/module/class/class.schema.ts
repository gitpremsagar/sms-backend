import { ClassKind } from "@prisma/client";
import { z } from "zod";

export const classKindSchema = z.nativeEnum(ClassKind);

export const listClassesQuerySchema = z.object({
  kind: classKindSchema.optional(),
});

export const createClassSchema = z.object({
  className: z.string().min(1),
  teacherId: z.string().min(1),
  monthlyFee: z.coerce.number().min(0).optional(),
  kind: classKindSchema,
});

export const updateClassSchema = z
  .object({
    className: z.string().min(1).optional(),
    teacherId: z.string().min(1).optional(),
    monthlyFee: z.coerce.number().min(0).optional(),
    kind: classKindSchema.optional(),
  })
  .refine((data) => Object.values(data).some((value) => value !== undefined), {
    message: "At least one field must be provided",
  });

export type CreateClassInput = z.infer<typeof createClassSchema>;
export type UpdateClassInput = z.infer<typeof updateClassSchema>;
export type ListClassesQuery = z.infer<typeof listClassesQuerySchema>;
