import type { Request, Response, NextFunction } from "express";
import { createClassSchema } from "./class.schema.js";
import { ClassError, createClass, listClasses } from "./class.service.js";

export async function listClassesHandler(
  _req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const classes = await listClasses();
    res.json({ classes });
  } catch (error) {
    next(error);
  }
}

export async function createClassHandler(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const parsed = createClassSchema.safeParse(req.body);

    if (!parsed.success) {
      res.status(400).json({ error: "Invalid request body" });
      return;
    }

    const schoolClass = await createClass(parsed.data);
    res.status(201).json({ class: schoolClass });
  } catch (error) {
    next(error);
  }
}

export function classErrorHandler(
  error: unknown,
  _req: Request,
  res: Response,
  next: NextFunction,
) {
  if (error instanceof ClassError) {
    res.status(error.statusCode).json({ error: error.message });
    return;
  }

  next(error);
}
