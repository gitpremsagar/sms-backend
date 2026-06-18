import type { Request, Response, NextFunction } from "express";
import { createTeacherSchema } from "./teacher.schema.js";
import {
  TeacherError,
  createTeacher,
  listTeachers,
} from "./teacher.service.js";

export async function listTeachersHandler(
  _req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const teachers = await listTeachers();
    res.json({ teachers });
  } catch (error) {
    next(error);
  }
}

export async function createTeacherHandler(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const parsed = createTeacherSchema.safeParse(req.body);

    if (!parsed.success) {
      res.status(400).json({ error: "Invalid request body" });
      return;
    }

    const teacher = await createTeacher(parsed.data);
    res.status(201).json({ teacher });
  } catch (error) {
    next(error);
  }
}

export function teacherErrorHandler(
  error: unknown,
  _req: Request,
  res: Response,
  next: NextFunction,
) {
  if (error instanceof TeacherError) {
    res.status(error.statusCode).json({ error: error.message });
    return;
  }

  next(error);
}
