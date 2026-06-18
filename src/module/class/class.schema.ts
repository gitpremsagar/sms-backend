import { z } from "zod";

export const createClassSchema = z.object({
  className: z.string().min(1),
  teacherId: z.string().min(1),
});

export type CreateClassInput = z.infer<typeof createClassSchema>;
