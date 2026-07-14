import type { Request, Response, NextFunction } from "express";
import { objectIdParamSchema } from "../../lib/object-id.js";
import {
  qrPunchSchema,
  registerQuerySchema,
} from "../attendance/attendance.schema.js";
import {
  AttendanceError,
  NotificationError,
  SalaryError,
  TeacherPortalError,
  getMyAttendanceRegister,
  getMyClassById,
  getMyNotifications,
  getMySalary,
  listMyClasses,
  markMyNotificationRead,
  qrPunch,
} from "./teacher-portal.service.js";
import { StudentAttendanceError } from "../student-attendance/student-attendance.service.js";

export async function getMyAttendanceRegisterHandler(
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

    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }

    const register = await getMyAttendanceRegister(
      userId,
      parsed.data.year,
      parsed.data.month,
    );
    res.json({ register });
  } catch (error) {
    next(error);
  }
}

export async function qrPunchHandler(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const parsed = qrPunchSchema.safeParse(req.body);

    if (!parsed.success) {
      res.status(400).json({ error: "Invalid request body" });
      return;
    }

    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }

    const result = await qrPunch(userId, parsed.data.token);
    res.json(result);
  } catch (error) {
    next(error);
  }
}

export async function getMySalaryHandler(
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

    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }

    const breakdown = await getMySalary(
      userId,
      parsed.data.year,
      parsed.data.month,
    );
    res.json({ breakdown });
  } catch (error) {
    next(error);
  }
}

export async function listMyClassesHandler(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }

    const classes = await listMyClasses(userId);
    res.json({ classes });
  } catch (error) {
    next(error);
  }
}

export async function getMyClassByIdHandler(
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

    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }

    const schoolClass = await getMyClassById(userId, params.data.id);
    res.json({ class: schoolClass });
  } catch (error) {
    next(error);
  }
}

export async function getMyNotificationsHandler(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }

    const notifications = await getMyNotifications(userId);
    res.json({ notifications });
  } catch (error) {
    next(error);
  }
}

export async function markMyNotificationReadHandler(
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

    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }

    await markMyNotificationRead(userId, params.data.id);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
}

export function teacherPortalErrorHandler(
  error: unknown,
  _req: Request,
  res: Response,
  next: NextFunction,
) {
  if (
    error instanceof TeacherPortalError ||
    error instanceof AttendanceError ||
    error instanceof NotificationError ||
    error instanceof SalaryError ||
    error instanceof StudentAttendanceError
  ) {
    res.status(error.statusCode).json({ error: error.message });
    return;
  }

  next(error);
}
