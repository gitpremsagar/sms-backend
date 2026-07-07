import type { Request, Response, NextFunction } from "express";
import { Role } from "@prisma/client";
import { objectIdParamSchema } from "../../lib/object-id.js";
import {
  dailyDateQuerySchema,
  dailyQuerySchema,
  markSchema,
  monthYearQuerySchema,
  registerQuerySchema,
  saveDailyBodySchema,
  saveDailySchema,
  undoQuerySchema,
} from "./student-attendance.schema.js";
import {
  StudentAttendanceError,
  assertClassAccess,
  getDailyRoster,
  getRegister,
  markStudentAttendance,
  saveDailyAttendance,
  undoRecord,
} from "./student-attendance.service.js";

function getUserContext(req: Request): {
  userId: string;
  role: Role;
} | null {
  const userId = req.user?.userId;
  const role = req.user?.role;

  if (!userId || !role) {
    return null;
  }

  return { userId, role };
}

export async function getRegisterHandler(
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

    const user = getUserContext(req);
    if (!user) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }

    await assertClassAccess(user.userId, parsed.data.classId, user.role);

    const register = await getRegister(
      parsed.data.classId,
      parsed.data.year,
      parsed.data.month,
    );
    res.json({ register });
  } catch (error) {
    next(error);
  }
}

export async function getDailyRosterHandler(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const parsed = dailyQuerySchema.safeParse(req.query);

    if (!parsed.success) {
      res.status(400).json({ error: "Invalid query parameters" });
      return;
    }

    const user = getUserContext(req);
    if (!user) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }

    await assertClassAccess(user.userId, parsed.data.classId, user.role);

    const roster = await getDailyRoster(parsed.data.classId, parsed.data.date);
    res.json({ roster });
  } catch (error) {
    next(error);
  }
}

export async function saveDailyHandler(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const parsed = saveDailySchema.safeParse(req.body);

    if (!parsed.success) {
      res.status(400).json({ error: "Invalid request body" });
      return;
    }

    const user = getUserContext(req);
    if (!user) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }

    await assertClassAccess(user.userId, parsed.data.classId, user.role);

    await saveDailyAttendance(
      parsed.data.classId,
      parsed.data.date,
      parsed.data.entries,
      user.userId,
    );
    res.status(204).send();
  } catch (error) {
    next(error);
  }
}

export async function markHandler(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const parsed = markSchema.safeParse(req.body);

    if (!parsed.success) {
      res.status(400).json({ error: "Invalid request body" });
      return;
    }

    const user = getUserContext(req);
    if (!user) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }

    const classId = parsed.data.classId;

    await assertClassAccess(user.userId, classId, user.role);

    const record = await markStudentAttendance(
      classId,
      parsed.data.studentId,
      parsed.data.date,
      parsed.data.status,
      user.userId,
    );
    res.json({ record });
  } catch (error) {
    next(error);
  }
}

export async function undoRecordHandler(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const parsed = undoQuerySchema.safeParse(req.query);

    if (!parsed.success) {
      res.status(400).json({ error: "Invalid query parameters" });
      return;
    }

    const classId = req.query.classId;
    if (typeof classId !== "string" || !classId) {
      res.status(400).json({ error: "classId is required" });
      return;
    }

    const user = getUserContext(req);
    if (!user) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }

    await assertClassAccess(user.userId, classId, user.role);

    await undoRecord(classId, parsed.data.studentId, parsed.data.date);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
}

export async function getClassRegisterHandler(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const params = objectIdParamSchema.safeParse(req.params);
    const parsed = monthYearQuerySchema.safeParse(req.query);

    if (!params.success || !parsed.success) {
      res.status(400).json({ error: "Invalid parameters" });
      return;
    }

    const user = getUserContext(req);
    if (!user) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }

    await assertClassAccess(user.userId, params.data.id, user.role);

    const register = await getRegister(
      params.data.id,
      parsed.data.year,
      parsed.data.month,
    );
    res.json({ register });
  } catch (error) {
    next(error);
  }
}

export async function getClassDailyRosterHandler(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const params = objectIdParamSchema.safeParse(req.params);
    const parsed = dailyDateQuerySchema.safeParse(req.query);

    if (!params.success || !parsed.success) {
      res.status(400).json({ error: "Invalid parameters" });
      return;
    }

    const user = getUserContext(req);
    if (!user) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }

    await assertClassAccess(user.userId, params.data.id, user.role);

    const roster = await getDailyRoster(params.data.id, parsed.data.date);
    res.json({ roster });
  } catch (error) {
    next(error);
  }
}

export async function saveClassDailyHandler(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const params = objectIdParamSchema.safeParse(req.params);
    const parsed = saveDailyBodySchema.safeParse(req.body);

    if (!params.success || !parsed.success) {
      res.status(400).json({ error: "Invalid request body" });
      return;
    }

    const user = getUserContext(req);
    if (!user) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }

    await assertClassAccess(user.userId, params.data.id, user.role);

    await saveDailyAttendance(
      params.data.id,
      parsed.data.date,
      parsed.data.entries,
      user.userId,
    );
    res.status(204).send();
  } catch (error) {
    next(error);
  }
}

export async function markClassHandler(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const params = objectIdParamSchema.safeParse(req.params);
    const parsed = markSchema.safeParse(req.body);

    if (!params.success || !parsed.success) {
      res.status(400).json({ error: "Invalid request body" });
      return;
    }

    const user = getUserContext(req);
    if (!user) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }

    await assertClassAccess(user.userId, params.data.id, user.role);

    const record = await markStudentAttendance(
      params.data.id,
      parsed.data.studentId,
      parsed.data.date,
      parsed.data.status,
      user.userId,
    );
    res.json({ record });
  } catch (error) {
    next(error);
  }
}

export async function undoClassRecordHandler(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const params = objectIdParamSchema.safeParse(req.params);
    const parsed = undoQuerySchema.safeParse(req.query);

    if (!params.success || !parsed.success) {
      res.status(400).json({ error: "Invalid query parameters" });
      return;
    }

    const user = getUserContext(req);
    if (!user) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }

    await assertClassAccess(user.userId, params.data.id, user.role);

    await undoRecord(
      params.data.id,
      parsed.data.studentId,
      parsed.data.date,
    );
    res.status(204).send();
  } catch (error) {
    next(error);
  }
}

export function studentAttendanceErrorHandler(
  error: unknown,
  _req: Request,
  res: Response,
  next: NextFunction,
) {
  if (error instanceof StudentAttendanceError) {
    res.status(error.statusCode).json({ error: error.message });
    return;
  }

  next(error);
}
