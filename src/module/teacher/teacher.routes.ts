import { Role } from "@prisma/client";
import { Router } from "express";
import { authenticate } from "../../middleware/auth.middleware.js";
import { requireRole } from "../../middleware/require-role.middleware.js";
import {
  createTeacherHandler,
  deleteTeacherHandler,
  getTeacherByIdHandler,
  listTeachersHandler,
  teacherErrorHandler,
  updateTeacherHandler,
} from "./teacher.controller.js";

const teacherRouter = Router();

teacherRouter.use(authenticate, requireRole(Role.ADMIN));

teacherRouter.get("/", listTeachersHandler);
teacherRouter.post("/", createTeacherHandler);
teacherRouter.get("/:id", getTeacherByIdHandler);
teacherRouter.patch("/:id", updateTeacherHandler);
teacherRouter.delete("/:id", deleteTeacherHandler);
teacherRouter.use(teacherErrorHandler);

export default teacherRouter;
