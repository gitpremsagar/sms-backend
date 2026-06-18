import { Role } from "@prisma/client";
import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  expectedRole: z.nativeEnum(Role),
});

export type LoginInput = z.infer<typeof loginSchema>;
