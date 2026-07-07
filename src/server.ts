import "dotenv/config";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import authRouter from "./module/auth/auth.routes.js";
import { authErrorHandler } from "./module/auth/auth.controller.js";
import teacherRouter from "./module/teacher/teacher.routes.js";
import classRouter from "./module/class/class.routes.js";
import studentRouter from "./module/student/student.routes.js";
import attendanceRouter from "./module/attendance/attendance.routes.js";
import notificationRouter from "./module/notification/notification.routes.js";
import salaryRouter from "./module/salary/salary.routes.js";
import feeRouter from "./module/fee/fee.routes.js";
import studentAttendanceRouter from "./module/student-attendance/student-attendance.routes.js";
import teacherPortalRouter from "./module/teacher-portal/teacher-portal.routes.js";

const app = express();

const FRONTEND_URL = process.env.FRONTEND_URL ?? "http://localhost:3000";

app.use(
  cors({
    origin: FRONTEND_URL,
    credentials: true,
  }),
);
app.use(cookieParser());
app.use(express.json());

app.get("/", (_req, res) => {
  res.send("Sagar Middle School API");
});

app.use("/api/auth", authRouter);
app.use("/api/teachers", teacherRouter);
app.use("/api/classes", classRouter);
app.use("/api/students", studentRouter);
app.use("/api/attendance", attendanceRouter);
app.use("/api/salary", salaryRouter);
app.use("/api/fees", feeRouter);
app.use("/api/notifications", notificationRouter);
app.use("/api/student-attendance", studentAttendanceRouter);
app.use("/api/teacher", teacherPortalRouter);
app.use(authErrorHandler);

app.use(
  (
    error: Error,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction,
  ) => {
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
  },
);

const PORT = process.env.PORT || 3200;

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}\nhttp://localhost:${PORT}`);
});
