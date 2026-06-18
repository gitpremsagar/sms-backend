import { Role } from "@prisma/client";
import { Router } from "express";
import { authenticate } from "../../middleware/auth.middleware.js";
import { requireRole } from "../../middleware/require-role.middleware.js";
import {
  createStudentHandler,
  listStudentsHandler,
  studentErrorHandler,
} from "./student.controller.js";

const studentRouter = Router();

studentRouter.use(authenticate, requireRole(Role.ADMIN));

studentRouter.get("/", listStudentsHandler);
studentRouter.post("/", createStudentHandler);
studentRouter.use(studentErrorHandler);

export default studentRouter;
