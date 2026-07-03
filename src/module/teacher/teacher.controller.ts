import type { Request, Response, NextFunction } from "express";
import { Prisma } from "@prisma/client";
import { objectIdParamSchema } from "../../lib/object-id.js";
import { createTeacherSchema, updateTeacherSchema } from "./teacher.schema.js";
import {
  TeacherError,
  createTeacher,
  deleteTeacher,
  getTeacherById,
  listTeachers,
  updateTeacher,
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

export async function getTeacherByIdHandler(
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

    const teacher = await getTeacherById(parsed.data.id);
    res.json({ teacher });
  } catch (error) {
    next(error);
  }
}

export async function updateTeacherHandler(
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

    const parsed = updateTeacherSchema.safeParse(req.body);

    if (!parsed.success) {
      res.status(400).json({ error: "Invalid request body" });
      return;
    }

    const teacher = await updateTeacher(params.data.id, parsed.data);
    res.json({ teacher });
  } catch (error) {
    next(error);
  }
}

export async function deleteTeacherHandler(
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

    await deleteTeacher(parsed.data.id);
    res.status(204).send();
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

  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  ) {
    const target = error.meta?.target;
    const fields = Array.isArray(target)
      ? target.join(", ")
      : typeof target === "string"
        ? target
        : "";

    if (fields.includes("employeeId")) {
      res
        .status(409)
        .json({ error: "A teacher with this employee ID already exists" });
      return;
    }

    if (fields.includes("email")) {
      res.status(409).json({ error: "A user with this email already exists" });
      return;
    }
  }

  next(error);
}
