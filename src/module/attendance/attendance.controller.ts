import type { Request, Response, NextFunction } from "express";
import {
  declareHolidaySchema,
  punchSchema,
  registerQuerySchema,
  teacherDateSchema,
} from "./attendance.schema.js";
import {
  AttendanceError,
  declareHoliday,
  getRegister,
  markAbsent,
  punchIn,
  punchOut,
  removeHoliday,
  undoRecord,
} from "./attendance.service.js";

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

    const register = await getRegister(parsed.data.year, parsed.data.month);
    res.json({ register });
  } catch (error) {
    next(error);
  }
}

export async function punchInHandler(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const parsed = punchSchema.safeParse(req.body);

    if (!parsed.success) {
      res.status(400).json({ error: "Invalid request body" });
      return;
    }

    const record = await punchIn(
      parsed.data.teacherId,
      parsed.data.date,
      parsed.data.time,
    );
    res.json({ record });
  } catch (error) {
    next(error);
  }
}

export async function punchOutHandler(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const parsed = punchSchema.safeParse(req.body);

    if (!parsed.success) {
      res.status(400).json({ error: "Invalid request body" });
      return;
    }

    const record = await punchOut(
      parsed.data.teacherId,
      parsed.data.date,
      parsed.data.time,
    );
    res.json({ record });
  } catch (error) {
    next(error);
  }
}

export async function markAbsentHandler(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const parsed = teacherDateSchema.safeParse(req.body);

    if (!parsed.success) {
      res.status(400).json({ error: "Invalid request body" });
      return;
    }

    const record = await markAbsent(parsed.data.teacherId, parsed.data.date);
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
    const parsed = teacherDateSchema.safeParse(req.body);

    if (!parsed.success) {
      res.status(400).json({ error: "Invalid request body" });
      return;
    }

    await undoRecord(parsed.data.teacherId, parsed.data.date);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
}

export async function declareHolidayHandler(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const parsed = declareHolidaySchema.safeParse(req.body);

    if (!parsed.success) {
      res.status(400).json({ error: "Invalid request body" });
      return;
    }

    const holiday = await declareHoliday(parsed.data.date, parsed.data.label);
    res.status(201).json({ holiday });
  } catch (error) {
    next(error);
  }
}

export async function removeHolidayHandler(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const dateParam = req.params.date;
    const date = Array.isArray(dateParam) ? dateParam[0] : dateParam;

    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      res.status(400).json({ error: "Invalid date parameter" });
      return;
    }

    await removeHoliday(date);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
}

export function attendanceErrorHandler(
  error: unknown,
  _req: Request,
  res: Response,
  next: NextFunction,
) {
  if (error instanceof AttendanceError) {
    res.status(error.statusCode).json({ error: error.message });
    return;
  }

  next(error);
}
