import { z } from "zod";

export const createTeacherSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(6),
  employeeId: z.string().min(1).optional(),
  phone: z.string().min(1).optional(),
});

export type CreateTeacherInput = z.infer<typeof createTeacherSchema>;
