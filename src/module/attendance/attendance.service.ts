import { AttendanceStatus, Role } from "@prisma/client";
import prisma from "../../lib/prisma.js";
import {
  type MonthlySummary,
  computeMonthlySummary,
} from "./attendance.classify.js";

export type AttendanceRecordDto = {
  status: AttendanceStatus;
  punchIn: string | null;
  punchOut: string | null;
};

export type RegisterTeacherDto = {
  id: string;
  name: string;
  employeeId: string | null;
  workStartTime: string;
  workEndTime: string;
  halfDayThresholdTime: string;
};

export type RegisterDto = {
  teachers: RegisterTeacherDto[];
  records: Record<string, AttendanceRecordDto>;
  summaries: Record<string, MonthlySummary>;
  holidays: string[];
  declaredHolidays: string[];
  year: number;
  month: number;
  daysInMonth: number;
};

function formatDate(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function parseDate(date: string): Date {
  const parts = date.split("-").map(Number);
  const year = parts[0] ?? 0;
  const month = parts[1] ?? 1;
  const day = parts[2] ?? 1;
  return new Date(year, month - 1, day);
}

export function isSunday(date: string): boolean {
  return parseDate(date).getDay() === 0;
}

/** Store wall-clock HH:mm as UTC components so display is timezone-independent. */
export function combineDateAndTime(date: string, time: string): Date {
  const parts = date.split("-").map(Number);
  const year = parts[0] ?? 0;
  const month = parts[1] ?? 1;
  const day = parts[2] ?? 1;
  const timeParts = time.split(":").map(Number);
  const hours = timeParts[0] ?? 0;
  const minutes = timeParts[1] ?? 0;

  return new Date(Date.UTC(year, month - 1, day, hours, minutes, 0, 0));
}

function wallClockNow(): Date {
  const now = new Date();
  return new Date(
    Date.UTC(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      now.getHours(),
      now.getMinutes(),
      now.getSeconds(),
      now.getMilliseconds(),
    ),
  );
}

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

export async function isHolidayDate(date: string): Promise<boolean> {
  if (isSunday(date)) {
    return true;
  }

  const holiday = await prisma.holiday.findUnique({
    where: { date },
  });

  return holiday !== null;
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

function recordKey(teacherId: string, date: string): string {
  return `${teacherId}:${date}`;
}

function toRecordDto(record: {
  status: AttendanceStatus;
  punchIn: Date | null;
  punchOut: Date | null;
}): AttendanceRecordDto {
  return {
    status: record.status,
    punchIn: record.punchIn?.toISOString() ?? null,
    punchOut: record.punchOut?.toISOString() ?? null,
  };
}

export async function getRegister(year: number, month: number): Promise<RegisterDto> {
  const { startDate, endDate, daysInMonth } = getMonthDateRange(year, month);

  const [teachersRaw, attendanceRecords, holidayData] = await Promise.all([
    prisma.user.findMany({
      where: { role: Role.TEACHER },
      include: { teacherDetail: true },
      orderBy: { name: "asc" },
    }),
    prisma.teacherAttendance.findMany({
      where: {
        date: { gte: startDate, lte: endDate },
      },
    }),
    getHolidayDatesForMonth(year, month),
  ]);

  const teachers = teachersRaw
    .filter((user) => user.teacherDetail)
    .map((user) => ({
      id: user.teacherDetail!.id,
      name: user.name,
      employeeId: user.teacherDetail!.employeeId,
      workStartTime: user.teacherDetail!.workStartTime,
      workEndTime: user.teacherDetail!.workEndTime,
      halfDayThresholdTime: user.teacherDetail!.halfDayThresholdTime,
    }));

  return buildRegisterDto({
    teachers,
    attendanceRecords,
    holidayData,
    year,
    month,
    daysInMonth,
  });
}

export async function getRegisterForTeacher(
  userId: string,
  year: number,
  month: number,
): Promise<RegisterDto> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { teacherDetail: true },
  });

  if (!user?.teacherDetail) {
    throw new AttendanceError("Teacher profile not found", 404);
  }

  const { startDate, endDate, daysInMonth } = getMonthDateRange(year, month);
  const teacherDetail = user.teacherDetail;

  const [attendanceRecords, holidayData] = await Promise.all([
    prisma.teacherAttendance.findMany({
      where: {
        teacherId: teacherDetail.id,
        date: { gte: startDate, lte: endDate },
      },
    }),
    getHolidayDatesForMonth(year, month),
  ]);

  const teachers = [
    {
      id: teacherDetail.id,
      name: user.name,
      employeeId: teacherDetail.employeeId,
      workStartTime: teacherDetail.workStartTime,
      workEndTime: teacherDetail.workEndTime,
      halfDayThresholdTime: teacherDetail.halfDayThresholdTime,
    },
  ];

  return buildRegisterDto({
    teachers,
    attendanceRecords,
    holidayData,
    year,
    month,
    daysInMonth,
  });
}

function buildRegisterDto({
  teachers,
  attendanceRecords,
  holidayData,
  year,
  month,
  daysInMonth,
}: {
  teachers: RegisterTeacherDto[];
  attendanceRecords: {
    teacherId: string;
    date: string;
    status: AttendanceStatus;
    punchIn: Date | null;
    punchOut: Date | null;
  }[];
  holidayData: { holidays: string[]; declaredHolidays: string[] };
  year: number;
  month: number;
  daysInMonth: number;
}): RegisterDto {
  const records: Record<string, AttendanceRecordDto> = {};
  for (const record of attendanceRecords) {
    records[recordKey(record.teacherId, record.date)] = toRecordDto(record);
  }

  const summaries: Record<string, MonthlySummary> = {};
  for (const teacher of teachers) {
    summaries[teacher.id] = computeMonthlySummary(
      teacher.id,
      {
        workStartTime: teacher.workStartTime,
        workEndTime: teacher.workEndTime,
        halfDayThresholdTime: teacher.halfDayThresholdTime,
      },
      records,
      year,
      month,
      daysInMonth,
      holidayData.holidays,
    );
  }

  return {
    teachers,
    records,
    summaries,
    holidays: holidayData.holidays,
    declaredHolidays: holidayData.declaredHolidays,
    year,
    month,
    daysInMonth,
  };
}

async function assertNotHoliday(date: string): Promise<void> {
  if (await isHolidayDate(date)) {
    throw new AttendanceError("Attendance cannot be modified on a holiday", 400);
  }
}

async function assertTeacherExists(teacherId: string): Promise<void> {
  const teacher = await prisma.teacherDetail.findUnique({
    where: { id: teacherId },
  });

  if (!teacher) {
    throw new AttendanceError("Teacher not found", 404);
  }
}

export async function punchIn(
  teacherId: string,
  date: string,
  time?: string,
): Promise<AttendanceRecordDto> {
  await assertTeacherExists(teacherId);
  await assertNotHoliday(date);

  const existing = await prisma.teacherAttendance.findUnique({
    where: { teacherId_date: { teacherId, date } },
  });

  if (existing) {
    throw new AttendanceError("Attendance record already exists. Undo first to start over.", 400);
  }

  const punchInTime = time ? combineDateAndTime(date, time) : wallClockNow();

  const record = await prisma.teacherAttendance.create({
    data: {
      teacherId,
      date,
      status: AttendanceStatus.IN_PROGRESS,
      punchIn: punchInTime,
    },
  });

  return toRecordDto(record);
}

export async function punchOut(
  teacherId: string,
  date: string,
  time?: string,
): Promise<AttendanceRecordDto> {
  await assertTeacherExists(teacherId);
  await assertNotHoliday(date);

  const existing = await prisma.teacherAttendance.findUnique({
    where: { teacherId_date: { teacherId, date } },
  });

  if (!existing?.punchIn) {
    throw new AttendanceError("Punch in is required before punch out", 400);
  }

  if (existing.punchOut) {
    throw new AttendanceError("Already punched out", 400);
  }

  const punchOutTime = time ? combineDateAndTime(date, time) : wallClockNow();

  if (punchOutTime <= existing.punchIn) {
    throw new AttendanceError("Punch out time must be after punch in time", 400);
  }

  const record = await prisma.teacherAttendance.update({
    where: { teacherId_date: { teacherId, date } },
    data: {
      status: AttendanceStatus.PRESENT,
      punchOut: punchOutTime,
    },
  });

  return toRecordDto(record);
}

export async function markAbsent(teacherId: string, date: string): Promise<AttendanceRecordDto> {
  await assertTeacherExists(teacherId);
  await assertNotHoliday(date);

  const existing = await prisma.teacherAttendance.findUnique({
    where: { teacherId_date: { teacherId, date } },
  });

  if (existing?.punchIn) {
    throw new AttendanceError("Cannot mark absent after punch in. Undo first.", 400);
  }

  const record = await prisma.teacherAttendance.upsert({
    where: { teacherId_date: { teacherId, date } },
    create: {
      teacherId,
      date,
      status: AttendanceStatus.ABSENT,
    },
    update: {
      status: AttendanceStatus.ABSENT,
      punchIn: null,
      punchOut: null,
    },
  });

  return toRecordDto(record);
}

export type BulkPunchSkippedTeacher = {
  id: string;
  name: string;
  reason: string;
};

export type BulkPunchSummary = {
  date: string;
  processed: number;
  skipped: number;
  skippedTeachers: BulkPunchSkippedTeacher[];
};

async function loadAllTeachers(): Promise<{ id: string; name: string }[]> {
  const teachersRaw = await prisma.user.findMany({
    where: { role: Role.TEACHER },
    include: { teacherDetail: true },
    orderBy: { name: "asc" },
  });

  return teachersRaw
    .filter((user) => user.teacherDetail)
    .map((user) => ({
      id: user.teacherDetail!.id,
      name: user.name,
    }));
}

export async function bulkPunchIn(
  date: string,
  time?: string,
): Promise<BulkPunchSummary> {
  await assertNotHoliday(date);

  const teachers = await loadAllTeachers();
  const existingRecords = await prisma.teacherAttendance.findMany({
    where: { date },
  });
  const existingByTeacherId = new Map(
    existingRecords.map((record) => [record.teacherId, record]),
  );

  const punchInTime = time ? combineDateAndTime(date, time) : wallClockNow();
  const eligible: { id: string; name: string }[] = [];
  const skippedTeachers: BulkPunchSkippedTeacher[] = [];

  for (const teacher of teachers) {
    const existing = existingByTeacherId.get(teacher.id);

    if (!existing) {
      eligible.push(teacher);
      continue;
    }

    if (existing.status === AttendanceStatus.IN_PROGRESS) {
      skippedTeachers.push({
        id: teacher.id,
        name: teacher.name,
        reason: "Already punched in",
      });
    } else if (existing.status === AttendanceStatus.PRESENT) {
      skippedTeachers.push({
        id: teacher.id,
        name: teacher.name,
        reason: "Already present",
      });
    } else {
      skippedTeachers.push({
        id: teacher.id,
        name: teacher.name,
        reason: "Already marked absent",
      });
    }
  }

  if (eligible.length === 0) {
    throw new AttendanceError("No teachers eligible for punch in", 400);
  }

  await prisma.$transaction(
    eligible.map((teacher) =>
      prisma.teacherAttendance.create({
        data: {
          teacherId: teacher.id,
          date,
          status: AttendanceStatus.IN_PROGRESS,
          punchIn: punchInTime,
        },
      }),
    ),
  );

  return {
    date,
    processed: eligible.length,
    skipped: skippedTeachers.length,
    skippedTeachers,
  };
}

export async function bulkPunchOut(
  date: string,
  time?: string,
): Promise<BulkPunchSummary> {
  await assertNotHoliday(date);

  const teachers = await loadAllTeachers();
  const existingRecords = await prisma.teacherAttendance.findMany({
    where: { date },
  });
  const existingByTeacherId = new Map(
    existingRecords.map((record) => [record.teacherId, record]),
  );

  const punchOutTime = time ? combineDateAndTime(date, time) : wallClockNow();
  const eligible: { id: string; name: string }[] = [];
  const skippedTeachers: BulkPunchSkippedTeacher[] = [];

  for (const teacher of teachers) {
    const existing = existingByTeacherId.get(teacher.id);

    if (!existing) {
      skippedTeachers.push({
        id: teacher.id,
        name: teacher.name,
        reason: "Not punched in",
      });
      continue;
    }

    if (!existing.punchIn) {
      skippedTeachers.push({
        id: teacher.id,
        name: teacher.name,
        reason: existing.status === AttendanceStatus.ABSENT
          ? "Marked absent"
          : "Not punched in",
      });
      continue;
    }

    if (existing.punchOut) {
      skippedTeachers.push({
        id: teacher.id,
        name: teacher.name,
        reason: "Already punched out",
      });
      continue;
    }

    if (punchOutTime <= existing.punchIn) {
      skippedTeachers.push({
        id: teacher.id,
        name: teacher.name,
        reason: "Punch out time must be after punch in time",
      });
      continue;
    }

    eligible.push(teacher);
  }

  if (eligible.length === 0) {
    throw new AttendanceError("No teachers eligible for punch out", 400);
  }

  await prisma.$transaction(
    eligible.map((teacher) =>
      prisma.teacherAttendance.update({
        where: { teacherId_date: { teacherId: teacher.id, date } },
        data: {
          status: AttendanceStatus.PRESENT,
          punchOut: punchOutTime,
        },
      }),
    ),
  );

  return {
    date,
    processed: eligible.length,
    skipped: skippedTeachers.length,
    skippedTeachers,
  };
}

export async function undoRecord(teacherId: string, date: string): Promise<void> {
  await assertTeacherExists(teacherId);
  await assertNotHoliday(date);

  const existing = await prisma.teacherAttendance.findUnique({
    where: { teacherId_date: { teacherId, date } },
  });

  if (!existing) {
    throw new AttendanceError("No attendance record to undo", 404);
  }

  await prisma.teacherAttendance.delete({
    where: { teacherId_date: { teacherId, date } },
  });
}

export async function declareHoliday(
  date: string,
  label?: string,
): Promise<{ date: string; label: string | null }> {
  if (isSunday(date)) {
    throw new AttendanceError("Sundays are already holidays", 400);
  }

  const holiday = await prisma.holiday.upsert({
    where: { date },
    create: { date, label: label ?? null },
    update: label ? { label } : {},
  });

  return { date: holiday.date, label: holiday.label };
}

export async function removeHoliday(date: string): Promise<void> {
  if (isSunday(date)) {
    throw new AttendanceError("Sundays cannot be removed as holidays", 400);
  }

  const existing = await prisma.holiday.findUnique({
    where: { date },
  });

  if (!existing) {
    throw new AttendanceError("Holiday not found", 404);
  }

  await prisma.holiday.delete({
    where: { date },
  });
}

export function getWallQrUrl(): { url: string } {
  const secret = process.env.ATTENDANCE_QR_SECRET;
  if (!secret) {
    throw new AttendanceError("Attendance QR secret is not configured", 500);
  }

  const baseUrl = (
    process.env.PUBLIC_API_BASE_URL ??
    `http://localhost:${process.env.PORT || 3200}`
  ).replace(/\/$/, "");

  const url = new URL(`${baseUrl}/api/teacher/attendance/qr-punch`);
  url.searchParams.set("token", secret);
  return { url: url.toString() };
}

export class AttendanceError extends Error {
  constructor(
    message: string,
    public statusCode: number,
  ) {
    super(message);
    this.name = "AttendanceError";
  }
}
