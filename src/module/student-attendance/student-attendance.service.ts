import { Role, StudentAttendanceStatus } from "@prisma/client";
import prisma from "../../lib/prisma.js";
import { schoolTodayDateString } from "../../lib/school-time.js";
import {
  isHolidayDate,
  isSunday,
} from "../attendance/attendance.service.js";

function formatDate(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export type StudentAttendanceRecordDto = {
  status: StudentAttendanceStatus;
};

export type RegisterStudentDto = {
  id: string;
  name: string;
  rollNumber: string;
  isStudying: boolean;
  classId: string;
  className: string;
};

export type GetRegisterOptions = {
  includeArchived?: boolean;
};

export type StudentMonthlySummary = {
  present: number;
  absent: number;
};

export type StudentAttendanceRegisterDto = {
  classId: string | null;
  className: string;
  classes: { id: string; className: string }[];
  students: RegisterStudentDto[];
  records: Record<string, StudentAttendanceRecordDto>;
  summaries: Record<string, StudentMonthlySummary>;
  holidays: string[];
  declaredHolidays: string[];
  year: number;
  month: number;
  daysInMonth: number;
};

export type DailyRosterStudentDto = {
  id: string;
  name: string;
  rollNumber: string;
  status: StudentAttendanceStatus | null;
};

export type StudentAttendanceDailyDto = {
  classId: string;
  className: string;
  classes: { id: string; className: string }[];
  date: string;
  isHoliday: boolean;
  students: DailyRosterStudentDto[];
};

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

function getMonthDateRange(year: number, month: number): {
  startDate: string;
  endDate: string;
  daysInMonth: number;
} {
  const daysInMonth = getDaysInMonth(year, month);
  return {
    startDate: formatDate(year, month, 1),
    endDate: formatDate(year, month, daysInMonth),
    daysInMonth,
  };
}

function getSundayDatesInMonth(year: number, month: number): string[] {
  const { daysInMonth } = getMonthDateRange(year, month);
  const sundays: string[] = [];

  for (let day = 1; day <= daysInMonth; day++) {
    const date = formatDate(year, month, day);
    if (isSunday(date)) {
      sundays.push(date);
    }
  }

  return sundays;
}

async function getHolidayDatesForMonth(
  year: number,
  month: number,
): Promise<{ holidays: string[]; declaredHolidays: string[] }> {
  const { startDate, endDate } = getMonthDateRange(year, month);

  const declared = await prisma.holiday.findMany({
    where: {
      date: { gte: startDate, lte: endDate },
    },
    orderBy: { date: "asc" },
  });

  const declaredHolidays = declared.map((h) => h.date);
  const sundays = getSundayDatesInMonth(year, month);
  const holidays = [...new Set([...sundays, ...declaredHolidays])].sort();

  return { holidays, declaredHolidays };
}

export function recordKey(studentId: string, date: string): string {
  return `${studentId}:${date}`;
}

function todayDateString(): string {
  return schoolTodayDateString();
}

function assertNotFutureDate(date: string): void {
  if (date > todayDateString()) {
    throw new StudentAttendanceError(
      "Attendance cannot be marked for future dates",
      400,
    );
  }
}

async function assertNotHoliday(date: string): Promise<void> {
  if (await isHolidayDate(date)) {
    throw new StudentAttendanceError(
      "Attendance cannot be modified on a holiday",
      400,
    );
  }
}

async function loadClasses(): Promise<{ id: string; className: string }[]> {
  return prisma.class.findMany({
    select: { id: true, className: true },
    orderBy: { className: "asc" },
  });
}

async function loadClassStudents(
  classId: string,
  options: { includeArchived?: boolean } = {},
) {
  const schoolClass = await prisma.class.findUnique({
    where: { id: classId },
    include: {
      students: {
        ...(options.includeArchived ? {} : { where: { isStudying: true } }),
        include: { user: { select: { name: true } } },
        orderBy: { studentRollNumber: "asc" },
      },
    },
  });

  if (!schoolClass) {
    throw new StudentAttendanceError("Class not found", 404);
  }

  return schoolClass;
}

async function loadRegisterStudents(
  classId: string | undefined,
  options: { includeArchived?: boolean } = {},
): Promise<{
  classId: string | null;
  className: string;
  students: {
    id: string;
    studentRollNumber: string;
    isStudying: boolean;
    classId: string;
    className: string;
    name: string;
  }[];
}> {
  if (classId) {
    const schoolClass = await loadClassStudents(classId, options);
    return {
      classId: schoolClass.id,
      className: schoolClass.className,
      students: schoolClass.students.map((student) => ({
        id: student.id,
        studentRollNumber: student.studentRollNumber,
        isStudying: student.isStudying,
        classId: schoolClass.id,
        className: schoolClass.className,
        name: student.user.name,
      })),
    };
  }

  const students = await prisma.studentDetail.findMany({
    ...(options.includeArchived ? {} : { where: { isStudying: true } }),
    include: {
      user: { select: { name: true } },
      class: { select: { id: true, className: true } },
    },
    orderBy: [
      { class: { className: "asc" } },
      { studentRollNumber: "asc" },
    ],
  });

  return {
    classId: null,
    className: "All Classes",
    students: students.map((student) => ({
      id: student.id,
      studentRollNumber: student.studentRollNumber,
      isStudying: student.isStudying,
      classId: student.class.id,
      className: student.class.className,
      name: student.user.name,
    })),
  };
}

async function getTeacherDetailId(userId: string): Promise<string> {
  const teacherDetail = await prisma.teacherDetail.findUnique({
    where: { userId },
  });

  if (!teacherDetail) {
    throw new StudentAttendanceError("Teacher profile not found", 404);
  }

  return teacherDetail.id;
}

export async function assertClassAccess(
  userId: string,
  classId: string,
  role: Role,
): Promise<void> {
  if (role === Role.ADMIN) {
    const schoolClass = await prisma.class.findUnique({
      where: { id: classId },
    });
    if (!schoolClass) {
      throw new StudentAttendanceError("Class not found", 404);
    }
    return;
  }

  if (role === Role.TEACHER) {
    const teacherId = await getTeacherDetailId(userId);
    const schoolClass = await prisma.class.findUnique({
      where: { id: classId },
    });

    if (!schoolClass) {
      throw new StudentAttendanceError("Class not found", 404);
    }

    if (schoolClass.teacherId !== teacherId) {
      throw new StudentAttendanceError("You do not have access to this class", 403);
    }
    return;
  }

  throw new StudentAttendanceError("Forbidden", 403);
}

async function assertStudentInClass(
  studentId: string,
  classId: string,
): Promise<void> {
  const student = await prisma.studentDetail.findUnique({
    where: { id: studentId },
  });

  if (!student || student.classId !== classId || !student.isStudying) {
    throw new StudentAttendanceError("Student not found in this class", 404);
  }
}

function computeStudentSummary(
  studentId: string,
  records: Record<string, StudentAttendanceRecordDto>,
  year: number,
  month: number,
  daysInMonth: number,
  holidays: string[],
): StudentMonthlySummary {
  let present = 0;
  let absent = 0;

  for (let day = 1; day <= daysInMonth; day++) {
    const date = formatDate(year, month, day);
    if (holidays.includes(date)) {
      continue;
    }

    const record = records[recordKey(studentId, date)];
    if (record?.status === StudentAttendanceStatus.PRESENT) {
      present++;
    } else if (record?.status === StudentAttendanceStatus.ABSENT) {
      absent++;
    }
  }

  return { present, absent };
}

export async function getRegister(
  classId: string | undefined,
  year: number,
  month: number,
  options: GetRegisterOptions = {},
): Promise<StudentAttendanceRegisterDto> {
  const registerStudents = await loadRegisterStudents(classId, {
    ...(options.includeArchived ? { includeArchived: true } : {}),
  });
  const { startDate, endDate, daysInMonth } = getMonthDateRange(year, month);
  const studentIds = registerStudents.students.map((s) => s.id);

  const [attendanceRecords, holidayData, classes] = await Promise.all([
    studentIds.length > 0
      ? prisma.studentAttendance.findMany({
          where: {
            studentId: { in: studentIds },
            date: { gte: startDate, lte: endDate },
          },
        })
      : Promise.resolve([]),
    getHolidayDatesForMonth(year, month),
    loadClasses(),
  ]);

  const records: Record<string, StudentAttendanceRecordDto> = {};
  for (const record of attendanceRecords) {
    records[recordKey(record.studentId, record.date)] = {
      status: record.status,
    };
  }

  const students: RegisterStudentDto[] = registerStudents.students.map(
    (student) => ({
      id: student.id,
      name: student.name,
      rollNumber: student.studentRollNumber,
      isStudying: student.isStudying,
      classId: student.classId,
      className: student.className,
    }),
  );

  const summaries: Record<string, StudentMonthlySummary> = {};
  for (const student of students) {
    summaries[student.id] = computeStudentSummary(
      student.id,
      records,
      year,
      month,
      daysInMonth,
      holidayData.holidays,
    );
  }

  return {
    classId: registerStudents.classId,
    className: registerStudents.className,
    classes,
    students,
    records,
    summaries,
    holidays: holidayData.holidays,
    declaredHolidays: holidayData.declaredHolidays,
    year,
    month,
    daysInMonth,
  };
}

export async function getDailyRoster(
  classId: string,
  date: string,
): Promise<StudentAttendanceDailyDto> {
  const schoolClass = await loadClassStudents(classId);
  const studentIds = schoolClass.students.map((s) => s.id);
  const isHoliday = await isHolidayDate(date);

  const [attendanceRecords, classes] = await Promise.all([
    studentIds.length > 0
      ? prisma.studentAttendance.findMany({
          where: {
            studentId: { in: studentIds },
            date,
          },
        })
      : Promise.resolve([]),
    loadClasses(),
  ]);

  const statusByStudent = new Map(
    attendanceRecords.map((record) => [record.studentId, record.status]),
  );

  return {
    classId: schoolClass.id,
    className: schoolClass.className,
    classes,
    date,
    isHoliday,
    students: schoolClass.students.map((student) => ({
      id: student.id,
      name: student.user.name,
      rollNumber: student.studentRollNumber,
      status: statusByStudent.get(student.id) ?? null,
    })),
  };
}

export async function saveDailyAttendance(
  classId: string,
  date: string,
  entries: { studentId: string; status: StudentAttendanceStatus }[],
  markedByUserId: string,
): Promise<void> {
  assertNotFutureDate(date);
  await assertNotHoliday(date);

  const schoolClass = await loadClassStudents(classId);
  const validStudentIds = new Set(schoolClass.students.map((s) => s.id));

  for (const entry of entries) {
    if (!validStudentIds.has(entry.studentId)) {
      throw new StudentAttendanceError(
        "One or more students do not belong to this class",
        400,
      );
    }
  }

  await prisma.$transaction(
    entries.map((entry) =>
      prisma.studentAttendance.upsert({
        where: {
          studentId_date: { studentId: entry.studentId, date },
        },
        create: {
          studentId: entry.studentId,
          date,
          status: entry.status,
          markedById: markedByUserId,
        },
        update: {
          status: entry.status,
          markedById: markedByUserId,
        },
      }),
    ),
  );
}

export async function markStudentAttendance(
  classId: string,
  studentId: string,
  date: string,
  status: StudentAttendanceStatus,
  markedByUserId: string,
): Promise<StudentAttendanceRecordDto> {
  assertNotFutureDate(date);
  await assertNotHoliday(date);
  await assertStudentInClass(studentId, classId);

  const record = await prisma.studentAttendance.upsert({
    where: { studentId_date: { studentId, date } },
    create: {
      studentId,
      date,
      status,
      markedById: markedByUserId,
    },
    update: {
      status,
      markedById: markedByUserId,
    },
  });

  return { status: record.status };
}

export async function undoRecord(
  classId: string,
  studentId: string,
  date: string,
): Promise<void> {
  await assertNotHoliday(date);
  await assertStudentInClass(studentId, classId);

  const existing = await prisma.studentAttendance.findUnique({
    where: { studentId_date: { studentId, date } },
  });

  if (!existing) {
    throw new StudentAttendanceError("No attendance record to clear", 404);
  }

  await prisma.studentAttendance.delete({
    where: { studentId_date: { studentId, date } },
  });
}

export class StudentAttendanceError extends Error {
  constructor(
    message: string,
    public statusCode: number,
  ) {
    super(message);
    this.name = "StudentAttendanceError";
  }
}
