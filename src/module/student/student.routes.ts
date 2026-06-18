import { Role } from "@prisma/client";
import { Router } from "express";
import { authenticate } from "../../middleware/auth.middleware.js";
import { requireRole } from "../../middleware/require-role.middleware.js";
import {
  createStudentHandler,
  deleteStudentHandler,
  getStudentByIdHandler,
  listStudentsHandler,
  studentErrorHandler,
  updateStudentHandler,
} from "./student.controller.js";

const studentRouter = Router();

studentRouter.use(authenticate, requireRole(Role.ADMIN));

studentRouter.get("/", listStudentsHandler);
studentRouter.post("/", createStudentHandler);
studentRouter.get("/:id", getStudentByIdHandler);
studentRouter.patch("/:id", updateStudentHandler);
studentRouter.delete("/:id", deleteStudentHandler);
studentRouter.use(studentErrorHandler);

export default studentRouter;
