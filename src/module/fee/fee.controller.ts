import type { Request, Response, NextFunction } from "express";
import { Role } from "@prisma/client";
import {
  feeRegisterQuerySchema,
  feeReportQuerySchema,
  updateFeePaymentSchema,
} from "./fee.schema.js";
import {
  FeeError,
  getFeeRegister,
  getFeeReport,
  updateFeePayment,
} from "./fee.service.js";

export async function getFeeRegisterHandler(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const parsed = feeRegisterQuerySchema.safeParse(req.query);

    if (!parsed.success) {
      res.status(400).json({ error: "Invalid query parameters" });
      return;
    }

    const register = await getFeeRegister(
      parsed.data.financialYearStart,
      parsed.data.classId,
    );
    res.json({ register });
  } catch (error) {
    next(error);
  }
}

export async function getFeeReportHandler(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    if (req.user?.role !== Role.ADMIN) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    const parsed = feeReportQuerySchema.safeParse(req.query);

    if (!parsed.success) {
      res.status(400).json({ error: "Invalid query parameters" });
      return;
    }

    const report = await getFeeReport(parsed.data.financialYearStart);
    res.json({ report });
  } catch (error) {
    next(error);
  }
}

export async function updateFeePaymentHandler(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const parsed = updateFeePaymentSchema.safeParse(req.body);

    if (!parsed.success) {
      res.status(400).json({ error: "Invalid request body" });
      return;
    }

    if (!req.user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    await updateFeePayment(parsed.data, req.user.userId);
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
}

export function feeErrorHandler(
  error: unknown,
  _req: Request,
  res: Response,
  next: NextFunction,
) {
  if (error instanceof FeeError) {
    res.status(error.statusCode).json({ error: error.message });
    return;
  }

  next(error);
}
