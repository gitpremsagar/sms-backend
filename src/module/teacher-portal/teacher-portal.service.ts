import prisma from "../../lib/prisma.js";
import {
  AttendanceError,
  getRegisterForTeacher,
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
