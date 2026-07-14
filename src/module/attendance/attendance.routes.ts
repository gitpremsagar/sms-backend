import { Role } from "@prisma/client";
import { Router } from "express";
import { authenticate } from "../../middleware/auth.middleware.js";
import { requireRole } from "../../middleware/require-role.middleware.js";
import {
  attendanceErrorHandler,
  bulkPunchInHandler,
  bulkPunchOutHandler,
  declareHolidayHandler,
  getRegisterHandler,
  getWallQrHandler,
  markAbsentHandler,
  punchInHandler,
  punchOutHandler,
  removeHolidayHandler,
  undoRecordHandler,
} from "./attendance.controller.js";

const attendanceRouter = Router();

attendanceRouter.use(authenticate, requireRole(Role.ADMIN));

attendanceRouter.get("/register", getRegisterHandler);
attendanceRouter.get("/wall-qr", getWallQrHandler);
attendanceRouter.post("/punch-in", punchInHandler);
attendanceRouter.post("/punch-out", punchOutHandler);
attendanceRouter.post("/bulk-punch-in", bulkPunchInHandler);
attendanceRouter.post("/bulk-punch-out", bulkPunchOutHandler);
attendanceRouter.post("/mark-absent", markAbsentHandler);
attendanceRouter.delete("/record", undoRecordHandler);
attendanceRouter.post("/holidays", declareHolidayHandler);
attendanceRouter.delete("/holidays/:date", removeHolidayHandler);
attendanceRouter.use(attendanceErrorHandler);

export default attendanceRouter;
