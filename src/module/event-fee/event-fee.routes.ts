import { Role } from "@prisma/client";
import { Router } from "express";
import { authenticate } from "../../middleware/auth.middleware.js";
import { requireRole } from "../../middleware/require-role.middleware.js";
import {
  createEventFeeHandler,
  deleteEventFeeHandler,
  eventFeeErrorHandler,
  getEventFeeByIdHandler,
  getEventFeeRegisterHandler,
  getEventFeeReportHandler,
  listEventFeesHandler,
  updateEventFeeHandler,
  updateEventFeePaymentHandler,
} from "./event-fee.controller.js";

const eventFeeRouter = Router();

eventFeeRouter.use(authenticate, requireRole(Role.ADMIN, Role.TEACHER));

eventFeeRouter.get("/register", getEventFeeRegisterHandler);
eventFeeRouter.get("/report", getEventFeeReportHandler);
eventFeeRouter.patch("/payments", updateEventFeePaymentHandler);

eventFeeRouter.get("/", listEventFeesHandler);
eventFeeRouter.post("/", createEventFeeHandler);
eventFeeRouter.get("/:id", getEventFeeByIdHandler);
eventFeeRouter.patch("/:id", updateEventFeeHandler);
eventFeeRouter.delete("/:id", deleteEventFeeHandler);

eventFeeRouter.use(eventFeeErrorHandler);

export default eventFeeRouter;
