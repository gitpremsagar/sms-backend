import bcrypt from "bcrypt";
import type { Role } from "@prisma/client";
import prisma from "../../lib/prisma.js";
import { signToken } from "../../lib/jwt.js";
import type { LoginInput } from "./auth.schema.js";

export type SafeUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
};

function toSafeUser(user: {
  id: string;
  name: string;
  email: string;
  role: Role;
}): SafeUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
  };
}

export async function login(input: LoginInput): Promise<{ user: SafeUser; token: string }> {
  const user = await prisma.user.findUnique({
    where: { email: input.email },
  });

  if (!user) {
    throw new AuthError("Invalid email or password", 401);
  }

  const passwordMatches = await bcrypt.compare(input.password, user.password);

  if (!passwordMatches) {
    throw new AuthError("Invalid email or password", 401);
  }

  if (user.role !== input.expectedRole) {
    throw new AuthError("You do not have access to this portal", 403);
  }

  const token = signToken({ userId: user.id, role: user.role });

  return { user: toSafeUser(user), token };
}

export async function getUserById(userId: string): Promise<SafeUser | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
    },
  });

  return user ? toSafeUser(user) : null;
}

export class AuthError extends Error {
  constructor(
    message: string,
    public statusCode: number,
  ) {
    super(message);
    this.name = "AuthError";
  }
}
