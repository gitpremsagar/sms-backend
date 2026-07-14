import { Role } from "@prisma/client";
import { Router } from "express";
import { authenticate } from "../../middleware/auth.middleware.js";
import { requireRole } from "../../middleware/require-role.middleware.js";
import {
  getClassDailyRosterHandler,
  getClassRegisterHandler,
  markClassHandler,
  saveClassDailyHandler,
  studentAttendanceErrorHandler,
  undoClassRecordHandler,
} from "../student-attendance/student-attendance.controller.js";
import {
  getMyAttendanceRegisterHandler,
  getMyClassByIdHandler,
  getMyNotificationsHandler,
  getMySalaryHandler,
  listMyClassesHandler,
  markMyNotificationReadHandler,
  qrPunchHandler,
  teacherPortalErrorHandler,
} from "./teacher-portal.controller.js";

const teacherPortalRouter = Router();

teacherPortalRouter.use(authenticate, requireRole(Role.TEACHER));

teacherPortalRouter.get("/attendance/register", getMyAttendanceRegisterHandler);
teacherPortalRouter.post("/attendance/qr-punch", qrPunchHandler);
teacherPortalRouter.get("/salary", getMySalaryHandler);
teacherPortalRouter.get("/classes", listMyClassesHandler);
teacherPortalRouter.get("/classes/:id", getMyClassByIdHandler);
teacherPortalRouter.get(
  "/classes/:id/student-attendance/register",
  getClassRegisterHandler,
);
teacherPortalRouter.get(
  "/classes/:id/student-attendance/daily",
  getClassDailyRosterHandler,
);
teacherPortalRouter.post(
  "/classes/:id/student-attendance/save",
  saveClassDailyHandler,
);
teacherPortalRouter.post(
  "/classes/:id/student-attendance/mark",
  markClassHandler,
);
teacherPortalRouter.delete(
  "/classes/:id/student-attendance/record",
  undoClassRecordHandler,
);
teacherPortalRouter.get("/notifications", getMyNotificationsHandler);
teacherPortalRouter.post(
  "/notifications/:id/read",
  markMyNotificationReadHandler,
);
teacherPortalRouter.use(studentAttendanceErrorHandler);
teacherPortalRouter.use(teacherPortalErrorHandler);

export default teacherPortalRouter;
