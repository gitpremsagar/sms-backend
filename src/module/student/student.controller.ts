import type { Request, Response, NextFunction } from "express";
import { createStudentSchema } from "./student.schema.js";
import {
  StudentError,
  createStudent,
  listStudents,
} from "./student.service.js";

export async function listStudentsHandler(
  _req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const students = await listStudents();
    res.json({ students });
  } catch (error) {
    next(error);
  }
}

export async function createStudentHandler(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const parsed = createStudentSchema.safeParse(req.body);

    if (!parsed.success) {
      res.status(400).json({ error: "Invalid request body" });
      return;
    }

    const student = await createStudent(parsed.data);
    res.status(201).json({ student });
  } catch (error) {
    next(error);
  }
}

export function studentErrorHandler(
  error: unknown,
  _req: Request,
  res: Response,
  next: NextFunction,
) {
  if (error instanceof StudentError) {
    res.status(error.statusCode).json({ error: error.message });
    return;
  }

  next(error);
}
