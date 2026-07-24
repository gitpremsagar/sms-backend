import type { Request, Response, NextFunction } from "express";
import { Role } from "@prisma/client";
import { objectIdParamSchema } from "../../lib/object-id.js";
import {
  createEventFeeSchema,
  eventFeeListQuerySchema,
  eventFeeRegisterQuerySchema,
  eventFeeReportQuerySchema,
  updateEventFeePaymentSchema,
  updateEventFeeSchema,
} from "./event-fee.schema.js";
import {
  EventFeeError,
  createEventFee,
  deleteEventFee,
  getEventFeeById,
  getEventFeeRegister,
  getEventFeeReport,
  listEventFees,
  updateEventFee,
  updateEventFeePayment,
} from "./event-fee.service.js";

function requireAdmin(req: Request, res: Response): boolean {
  if (req.user?.role !== Role.ADMIN) {
    res.status(403).json({ error: "Forbidden" });
    return false;
  }
  return true;
}

export async function listEventFeesHandler(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    if (!requireAdmin(req, res)) {
      return;
    }

    const parsed = eventFeeListQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid query parameters" });
      return;
    }

    const events = await listEventFees(parsed.data.financialYearStart);
    res.json({ events });
  } catch (error) {
    next(error);
  }
}

export async function createEventFeeHandler(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    if (!requireAdmin(req, res)) {
      return;
    }

    const parsed = createEventFeeSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid request body" });
      return;
    }

    const event = await createEventFee(parsed.data);
    res.status(201).json({ event });
  } catch (error) {
    next(error);
  }
}

export async function getEventFeeByIdHandler(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    if (!requireAdmin(req, res)) {
      return;
    }

    const parsed = objectIdParamSchema.safeParse(req.params);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }

    const event = await getEventFeeById(parsed.data.id);
    res.json({ event });
  } catch (error) {
    next(error);
  }
}

export async function updateEventFeeHandler(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    if (!requireAdmin(req, res)) {
      return;
    }

    const params = objectIdParamSchema.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }

    const parsed = updateEventFeeSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid request body" });
      return;
    }

    const event = await updateEventFee(params.data.id, parsed.data);
    res.json({ event });
  } catch (error) {
    next(error);
  }
}

export async function deleteEventFeeHandler(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    if (!requireAdmin(req, res)) {
      return;
    }

    const parsed = objectIdParamSchema.safeParse(req.params);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }

    await deleteEventFee(parsed.data.id);
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
}

export async function getEventFeeRegisterHandler(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const parsed = eventFeeRegisterQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid query parameters" });
      return;
    }

    const register = await getEventFeeRegister(
      parsed.data.financialYearStart,
      parsed.data.eventFeeId,
      parsed.data.classId,
    );
    res.json({ register });
  } catch (error) {
    next(error);
  }
}

export async function getEventFeeReportHandler(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    if (!requireAdmin(req, res)) {
      return;
    }

    const parsed = eventFeeReportQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid query parameters" });
      return;
    }

    const report = await getEventFeeReport(parsed.data.financialYearStart);
    res.json({ report });
  } catch (error) {
    next(error);
  }
}

export async function updateEventFeePaymentHandler(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const parsed = updateEventFeePaymentSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid request body" });
      return;
    }

    if (!req.user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    await updateEventFeePayment(parsed.data, req.user.userId);
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
}

export function eventFeeErrorHandler(
  error: unknown,
  _req: Request,
  res: Response,
  next: NextFunction,
) {
  if (error instanceof EventFeeError) {
    res.status(error.statusCode).json({ error: error.message });
    return;
  }

  next(error);
}
