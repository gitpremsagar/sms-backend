import { Role } from "@prisma/client";
import { Router } from "express";
import { authenticate } from "../../middleware/auth.middleware.js";
import { requireRole } from "../../middleware/require-role.middleware.js";
import {
  createNotificationHandler,
  listNotificationsHandler,
  notificationErrorHandler,
} from "./notification.controller.js";

const notificationRouter = Router();

notificationRouter.use(authenticate, requireRole(Role.ADMIN));

notificationRouter.get("/", listNotificationsHandler);
notificationRouter.post("/", createNotificationHandler);
notificationRouter.use(notificationErrorHandler);

export default notificationRouter;
