import { Role } from "@prisma/client";
import { Router } from "express";
import { authenticate } from "../../middleware/auth.middleware.js";
import { requireRole } from "../../middleware/require-role.middleware.js";
import {
  createTeacherHandler,
  listTeachersHandler,
  teacherErrorHandler,
} from "./teacher.controller.js";

const teacherRouter = Router();

teacherRouter.use(authenticate, requireRole(Role.ADMIN));

teacherRouter.get("/", listTeachersHandler);
teacherRouter.post("/", createTeacherHandler);
teacherRouter.use(teacherErrorHandler);

export default teacherRouter;
