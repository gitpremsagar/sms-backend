import type { Request, Response, NextFunction } from "express";
import { objectIdParamSchema } from "../../lib/object-id.js";
import { importStudentsFromCsv } from "./student-import.service.js";
import {
  createStudentSchema,
  importStudentsSchema,
  updateStudentSchema,
} from "./student.schema.js";
import {
  StudentError,
  createStudent,
  deleteStudent,
  getStudentById,
  listStudents,
  updateStudent,
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

export async function importStudentsHandler(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const parsed = importStudentsSchema.safeParse(req.body);

    if (!parsed.success) {
      res.status(400).json({ error: "Invalid request body" });
      return;
    }

    const summary = await importStudentsFromCsv(parsed.data.csvContent);
    res.status(200).json({ summary });
  } catch (error) {
    next(error);
  }
}

export async function getStudentByIdHandler(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const parsed = objectIdParamSchema.safeParse(req.params);

    if (!parsed.success) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }

    const student = await getStudentById(parsed.data.id);
    res.json({ student });
  } catch (error) {
    next(error);
  }
}

export async function updateStudentHandler(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const params = objectIdParamSchema.safeParse(req.params);

    if (!params.success) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }

    const parsed = updateStudentSchema.safeParse(req.body);

    if (!parsed.success) {
      res.status(400).json({ error: "Invalid request body" });
      return;
    }

    const student = await updateStudent(params.data.id, parsed.data);
    res.json({ student });
  } catch (error) {
    next(error);
  }
}

export async function deleteStudentHandler(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const parsed = objectIdParamSchema.safeParse(req.params);

    if (!parsed.success) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }

    await deleteStudent(parsed.data.id);
    res.status(204).send();
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
