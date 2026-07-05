import { Role } from "@prisma/client";
import { Router } from "express";
import { authenticate } from "../../middleware/auth.middleware.js";
import { requireRole } from "../../middleware/require-role.middleware.js";
import {
  getSalaryRegisterHandler,
  salaryErrorHandler,
} from "./salary.controller.js";

const salaryRouter = Router();

salaryRouter.use(authenticate, requireRole(Role.ADMIN));

salaryRouter.get("/register", getSalaryRegisterHandler);
salaryRouter.use(salaryErrorHandler);

export default salaryRouter;
