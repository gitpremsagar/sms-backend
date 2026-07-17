import type { Request, Response, NextFunction } from "express";
import { objectIdParamSchema } from "../../lib/object-id.js";
import {
  createClassSchema,
  listClassesQuerySchema,
  updateClassSchema,
} from "./class.schema.js";
import {
  ClassError,
  createClass,
  deleteClass,
  getClassById,
  listClasses,
  updateClass,
} from "./class.service.js";

export async function listClassesHandler(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const parsed = listClassesQuerySchema.safeParse(req.query);

    if (!parsed.success) {
      res.status(400).json({ error: "Invalid query parameters" });
      return;
    }

    const classes = await listClasses(parsed.data.kind);
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

export async function getClassByIdHandler(
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

    const schoolClass = await getClassById(parsed.data.id);
    res.json({ class: schoolClass });
  } catch (error) {
    next(error);
  }
}

export async function updateClassHandler(
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

    const parsed = updateClassSchema.safeParse(req.body);

    if (!parsed.success) {
      res.status(400).json({ error: "Invalid request body" });
      return;
    }

    const schoolClass = await updateClass(params.data.id, parsed.data);
    res.json({ class: schoolClass });
  } catch (error) {
    next(error);
  }
}

export async function deleteClassHandler(
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

    await deleteClass(parsed.data.id);
    res.status(204).send();
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
