import { Role } from "@prisma/client";
import { Router } from "express";
import { authenticate } from "../../middleware/auth.middleware.js";
import { requireRole } from "../../middleware/require-role.middleware.js";
import {
  getDailyRosterHandler,
  getRegisterHandler,
  markHandler,
  saveDailyHandler,
  studentAttendanceErrorHandler,
  undoRecordHandler,
} from "./student-attendance.controller.js";

const studentAttendanceRouter = Router();

studentAttendanceRouter.use(authenticate, requireRole(Role.ADMIN));

studentAttendanceRouter.get("/register", getRegisterHandler);
studentAttendanceRouter.get("/daily", getDailyRosterHandler);
studentAttendanceRouter.post("/save", saveDailyHandler);
studentAttendanceRouter.post("/mark", markHandler);
studentAttendanceRouter.delete("/record", undoRecordHandler);
studentAttendanceRouter.use(studentAttendanceErrorHandler);

export default studentAttendanceRouter;
