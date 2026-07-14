import prisma from "../../lib/prisma.js";
import { schoolTodayDateString } from "../../lib/school-time.js";
import {
  AttendanceError,
  getRegisterForTeacher,
  punchIn,
  punchOut,
  type AttendanceRecordDto,
  type RegisterDto,
} from "../attendance/attendance.service.js";
import {
  type SalaryBreakdown,
  SalaryError,
  getSalaryForTeacher,
} from "../salary/salary.service.js";
import {
  NotificationError,
  listNotificationsForUser,
  markNotificationRead,
  type TeacherNotificationDto,
} from "../notification/notification.service.js";

export type QrPunchAction = "PUNCH_IN" | "PUNCH_OUT" | "ALREADY_COMPLETE";

export type QrPunchResult = {
  action: QrPunchAction;
  date: string;
  record: AttendanceRecordDto;
};

function toAttendanceRecordDto(record: {
  status: AttendanceRecordDto["status"];
  punchIn: Date | null;
  punchOut: Date | null;
}): AttendanceRecordDto {
  return {
    status: record.status,
    punchIn: record.punchIn?.toISOString() ?? null,
    punchOut: record.punchOut?.toISOString() ?? null,
  };
}

export type TeacherClassSummaryDto = {
  id: string;
  className: string;
  studentCount: number;
  createdAt: string;
};

export type TeacherClassStudentDto = {
  name: string;
  email: string;
  studentRollNumber: string;
};

export type TeacherClassDetailDto = {
  id: string;
  className: string;
  students: TeacherClassStudentDto[];
};

export async function getMyAttendanceRegister(
  userId: string,
  year: number,
  month: number,
): Promise<RegisterDto> {
  return getRegisterForTeacher(userId, year, month);
}

export async function qrPunch(
  userId: string,
  token: string,
): Promise<QrPunchResult> {
  const secret = process.env.ATTENDANCE_QR_SECRET;
  if (!secret || token !== secret) {
    throw new TeacherPortalError("Invalid attendance QR code", 403);
  }

  const teacherId = await getTeacherDetailId(userId);
  const date = schoolTodayDateString();

  const existing = await prisma.teacherAttendance.findUnique({
    where: { teacherId_date: { teacherId, date } },
  });

  if (!existing) {
    const record = await punchIn(teacherId, date);
    return { action: "PUNCH_IN", date, record };
  }

  if (existing.punchIn && !existing.punchOut) {
    const record = await punchOut(teacherId, date);
    return { action: "PUNCH_OUT", date, record };
  }

  return {
    action: "ALREADY_COMPLETE",
    date,
    record: toAttendanceRecordDto(existing),
  };
}

export async function getMySalary(
  userId: string,
  year: number,
  month: number,
): Promise<SalaryBreakdown> {
  return getSalaryForTeacher(userId, year, month);
}

async function getTeacherDetailId(userId: string): Promise<string> {
  const teacherDetail = await prisma.teacherDetail.findUnique({
    where: { userId },
  });

  if (!teacherDetail) {
    throw new TeacherPortalError("Teacher profile not found", 404);
  }

  return teacherDetail.id;
}

export async function listMyClasses(
  userId: string,
): Promise<TeacherClassSummaryDto[]> {
  const teacherId = await getTeacherDetailId(userId);

  const classes = await prisma.class.findMany({
    where: { teacherId },
    include: {
      _count: { select: { students: true } },
    },
    orderBy: { className: "asc" },
  });

  return classes.map((schoolClass) => ({
    id: schoolClass.id,
    className: schoolClass.className,
    studentCount: schoolClass._count.students,
    createdAt: schoolClass.createdAt.toISOString(),
  }));
}

export async function getMyClassById(
  userId: string,
  classId: string,
): Promise<TeacherClassDetailDto> {
  const teacherId = await getTeacherDetailId(userId);

  const schoolClass = await prisma.class.findUnique({
    where: { id: classId },
    include: {
      students: {
        include: { user: true },
        orderBy: { studentRollNumber: "asc" },
      },
    },
  });

  if (!schoolClass) {
    throw new TeacherPortalError("Class not found", 404);
  }

  if (schoolClass.teacherId !== teacherId) {
    throw new TeacherPortalError("You do not have access to this class", 403);
  }

  return {
    id: schoolClass.id,
    className: schoolClass.className,
    students: schoolClass.students.map((student) => ({
      name: student.user.name,
      email: student.user.email,
      studentRollNumber: student.studentRollNumber,
    })),
  };
}

export async function getMyNotifications(
  userId: string,
): Promise<TeacherNotificationDto[]> {
  return listNotificationsForUser(userId);
}

export async function markMyNotificationRead(
  userId: string,
  notificationId: string,
): Promise<void> {
  await markNotificationRead(userId, notificationId);
}

export class TeacherPortalError extends Error {
  constructor(
    message: string,
    public statusCode: number,
  ) {
    super(message);
    this.name = "TeacherPortalError";
  }
}

export { AttendanceError, NotificationError, SalaryError };
