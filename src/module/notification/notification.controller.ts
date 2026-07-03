import type { Request, Response, NextFunction } from "express";
import { createNotificationSchema } from "./notification.schema.js";
import {
  NotificationError,
  createNotification,
  listNotifications,
} from "./notification.service.js";

export async function createNotificationHandler(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const parsed = createNotificationSchema.safeParse(req.body);

    if (!parsed.success) {
      res.status(400).json({ error: "Invalid request body" });
      return;
    }

    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }

    const notification = await createNotification(
      userId,
      parsed.data.title,
      parsed.data.body,
    );
    res.status(201).json({ notification });
  } catch (error) {
    next(error);
  }
}

export async function listNotificationsHandler(
  _req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const notifications = await listNotifications();
    res.json({ notifications });
  } catch (error) {
    next(error);
  }
}

export function notificationErrorHandler(
  error: unknown,
  _req: Request,
  res: Response,
  next: NextFunction,
) {
  if (error instanceof NotificationError) {
    res.status(error.statusCode).json({ error: error.message });
    return;
  }

  next(error);
}
