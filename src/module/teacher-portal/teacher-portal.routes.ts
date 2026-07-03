import { Role } from "@prisma/client";
import { Router } from "express";
import { authenticate } from "../../middleware/auth.middleware.js";
import { requireRole } from "../../middleware/require-role.middleware.js";
import {
  getMyAttendanceRegisterHandler,
  getMyClassByIdHandler,
  getMyNotificationsHandler,
  listMyClassesHandler,
  markMyNotificationReadHandler,
  teacherPortalErrorHandler,
} from "./teacher-portal.controller.js";

const teacherPortalRouter = Router();

teacherPortalRouter.use(authenticate, requireRole(Role.TEACHER));

teacherPortalRouter.get("/attendance/register", getMyAttendanceRegisterHandler);
teacherPortalRouter.get("/classes", listMyClassesHandler);
teacherPortalRouter.get("/classes/:id", getMyClassByIdHandler);
teacherPortalRouter.get("/notifications", getMyNotificationsHandler);
teacherPortalRouter.post(
  "/notifications/:id/read",
  markMyNotificationReadHandler,
);
teacherPortalRouter.use(teacherPortalErrorHandler);

export default teacherPortalRouter;
