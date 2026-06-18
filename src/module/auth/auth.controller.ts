import type { Request, Response, NextFunction } from "express";
import {
  AUTH_COOKIE_MAX_AGE_MS,
  AUTH_COOKIE_NAME,
} from "../../lib/jwt.js";
import { loginSchema } from "./auth.schema.js";
import { AuthError, getUserById, login } from "./auth.service.js";

function setAuthCookie(res: Response, token: string) {
  res.cookie(AUTH_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: AUTH_COOKIE_MAX_AGE_MS,
    path: "/",
  });
}

function clearAuthCookie(res: Response) {
  res.clearCookie(AUTH_COOKIE_NAME, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
  });
}

export async function loginHandler(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const parsed = loginSchema.safeParse(req.body);

    if (!parsed.success) {
      res.status(400).json({ error: "Invalid request body" });
      return;
    }

    const { user, token } = await login(parsed.data);
    setAuthCookie(res, token);
    res.json({ user });
  } catch (error) {
    next(error);
  }
}

export function logoutHandler(_req: Request, res: Response) {
  clearAuthCookie(res);
  res.json({ message: "Logged out" });
}

export async function meHandler(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }

    const user = await getUserById(req.user.userId);

    if (!user) {
      clearAuthCookie(res);
      res.status(401).json({ error: "Not authenticated" });
      return;
    }

    res.json({ user });
  } catch (error) {
    next(error);
  }
}

export function authErrorHandler(
  error: unknown,
  _req: Request,
  res: Response,
  next: NextFunction,
) {
  if (error instanceof AuthError) {
    res.status(error.statusCode).json({ error: error.message });
    return;
  }

  next(error);
}
