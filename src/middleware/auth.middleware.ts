import type { Request, Response, NextFunction } from "express";
import {
  AUTH_COOKIE_NAME,
  verifyToken,
  type JwtPayload,
} from "../lib/jwt.js";

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

function extractBearerToken(authHeader: string | undefined): string | undefined {
  if (!authHeader?.startsWith("Bearer ")) {
    return undefined;
  }

  const token = authHeader.slice(7).trim();
  return token.length > 0 ? token : undefined;
}

export function authenticate(req: Request, res: Response, next: NextFunction) {
  const token =
    req.cookies?.[AUTH_COOKIE_NAME] ??
    extractBearerToken(req.headers.authorization);

  if (!token) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  try {
    req.user = verifyToken(token);
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired session" });
  }
}
