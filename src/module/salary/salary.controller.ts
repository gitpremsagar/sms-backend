import type { Request, Response, NextFunction } from "express";
import { registerQuerySchema } from "../attendance/attendance.schema.js";
import {
  SalaryError,
  getSalaryRegister,
} from "./salary.service.js";

export async function getSalaryRegisterHandler(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const parsed = registerQuerySchema.safeParse(req.query);

    if (!parsed.success) {
      res.status(400).json({ error: "Invalid query parameters" });
      return;
    }

    const register = await getSalaryRegister(parsed.data.year, parsed.data.month);
    res.json({ register });
  } catch (error) {
    next(error);
  }
}

export function salaryErrorHandler(
  error: unknown,
  _req: Request,
  res: Response,
  next: NextFunction,
) {
  if (error instanceof SalaryError) {
    res.status(error.statusCode).json({ error: error.message });
    return;
  }

  next(error);
}
