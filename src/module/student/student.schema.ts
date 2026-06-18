import { z } from "zod";

export const createStudentSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(6),
  studentRollNumber: z.string().min(1),
  classId: z.string().min(1),
});

export type CreateStudentInput = z.infer<typeof createStudentSchema>;
