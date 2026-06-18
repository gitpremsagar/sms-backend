import { Role } from "@prisma/client";
import { Router } from "express";
import { authenticate } from "../../middleware/auth.middleware.js";
import { requireRole } from "../../middleware/require-role.middleware.js";
import {
  classErrorHandler,
  createClassHandler,
  listClassesHandler,
} from "./class.controller.js";

const classRouter = Router();

classRouter.use(authenticate, requireRole(Role.ADMIN));

classRouter.get("/", listClassesHandler);
classRouter.post("/", createClassHandler);
classRouter.use(classErrorHandler);

export default classRouter;
