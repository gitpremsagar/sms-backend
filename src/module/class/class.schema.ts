import { z } from "zod";

export const createClassSchema = z.object({
  className: z.string().min(1),
  teacherId: z.string().min(1),
});

export const updateClassSchema = z
  .object({
    className: z.string().min(1).optional(),
    teacherId: z.string().min(1).optional(),
  })
  .refine((data) => Object.values(data).some((value) => value !== undefined), {
    message: "At least one field must be provided",
  });

export type CreateClassInput = z.infer<typeof createClassSchema>;
export type UpdateClassInput = z.infer<typeof updateClassSchema>;
