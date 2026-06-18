import { Router } from "express";
import { authenticate } from "../../middleware/auth.middleware.js";
import { loginHandler, logoutHandler, meHandler } from "./auth.controller.js";

const authRouter = Router();

authRouter.post("/login", loginHandler);
authRouter.post("/logout", logoutHandler);
authRouter.get("/me", authenticate, meHandler);

export default authRouter;
