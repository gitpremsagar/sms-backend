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

export function combineDateAndTime(date: string, time: string): Date {
  const parts = date.split("-").map(Number);
  const year = parts[0] ?? 0;
  const month = parts[1] ?? 1;
  const day = parts[2] ?? 1;
  const timeParts = time.split(":").map(Number);
  const hours = timeParts[0] ?? 0;
  const minutes = timeParts[1] ?? 0;

  return new Date(year, month - 1, day, hours, minutes, 0, 0);
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

  const records: Record<string, AttendanceRecordDto> = {};
  for (const record of attendanceRecords) {
    records[recordKey(record.teacherId, record.date)] = toRecordDto(record);
  }

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

  const punchInTime = time ? combineDateAndTime(date, time) : new Date();

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

  const punchOutTime = time ? combineDateAndTime(date, time) : new Date();

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

export class AttendanceError extends Error {
  constructor(
    message: string,
    public statusCode: number,
  ) {
    super(message);
    this.name = "AttendanceError";
  }
}
