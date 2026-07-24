import { Role } from "@prisma/client";
import { Router } from "express";
import { authenticate } from "../../middleware/auth.middleware.js";
import { requireRole } from "../../middleware/require-role.middleware.js";
import {
  feeErrorHandler,
  getFeeDueNoticesHandler,
  getFeeRegisterHandler,
  getFeeReportHandler,
  updateFeePaymentHandler,
} from "./fee.controller.js";

const feeRouter = Router();

feeRouter.use(authenticate, requireRole(Role.ADMIN, Role.TEACHER));

feeRouter.get("/register", getFeeRegisterHandler);
feeRouter.get("/report", getFeeReportHandler);
feeRouter.get("/due-notices", getFeeDueNoticesHandler);
feeRouter.patch("/payments", updateFeePaymentHandler);
feeRouter.use(feeErrorHandler);

export default feeRouter;
