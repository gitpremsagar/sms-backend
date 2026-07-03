import { AttendanceStatus } from "@prisma/client";
import type { AttendanceRecordDto } from "./attendance.service.js";

export type TeacherSchedule = {
  workStartTime: string;
  workEndTime: string;
  halfDayThresholdTime: string;
};

export type DayMetrics = {
  isPresent: boolean;
  isAbsent: boolean;
  isLatePunchIn: boolean;
  isHalfDay: boolean;
};

export type MonthlySummary = {
  present: number;
  absent: number;
  latePunchIn: number;
  halfDay: number;
};

export function parseTimeToMinutes(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return (hours ?? 0) * 60 + (minutes ?? 0);
}

export function getPunchMinutes(iso: string): number {
  const date = new Date(iso);
  return date.getHours() * 60 + date.getMinutes();
}

function formatDate(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function recordKey(teacherId: string, date: string): string {
  return `${teacherId}:${date}`;
}

export function classifyDay(
  record: AttendanceRecordDto | undefined,
  schedule: TeacherSchedule,
  isHoliday: boolean,
): DayMetrics {
  const empty: DayMetrics = {
    isPresent: false,
    isAbsent: false,
    isLatePunchIn: false,
    isHalfDay: false,
  };

  if (!record || isHoliday) {
    return empty;
  }

  if (record.status === AttendanceStatus.ABSENT) {
    return { ...empty, isAbsent: true };
  }

  if (
    record.status !== AttendanceStatus.PRESENT ||
    !record.punchIn ||
    !record.punchOut
  ) {
    return empty;
  }

  const workStart = parseTimeToMinutes(schedule.workStartTime);
  const halfDayThreshold = parseTimeToMinutes(schedule.halfDayThresholdTime);
  const punchInMinutes = getPunchMinutes(record.punchIn);
  const punchOutMinutes = getPunchMinutes(record.punchOut);

  const isHalfDay =
    punchInMinutes > halfDayThreshold || punchOutMinutes < halfDayThreshold;
  const isLatePunchIn = !isHalfDay && punchInMinutes > workStart;

  return {
    isPresent: true,
    isAbsent: false,
    isLatePunchIn,
    isHalfDay,
  };
}

export function computeMonthlySummary(
  teacherId: string,
  schedule: TeacherSchedule,
  records: Record<string, AttendanceRecordDto>,
  year: number,
  month: number,
  daysInMonth: number,
  holidays: string[],
): MonthlySummary {
  const summary: MonthlySummary = {
    present: 0,
    absent: 0,
    latePunchIn: 0,
    halfDay: 0,
  };

  const holidaySet = new Set(holidays);

  for (let day = 1; day <= daysInMonth; day++) {
    const date = formatDate(year, month, day);
    const record = records[recordKey(teacherId, date)];
    const metrics = classifyDay(record, schedule, holidaySet.has(date));

    if (metrics.isPresent) {
      summary.present++;
    }
    if (metrics.isAbsent) {
      summary.absent++;
    }
    if (metrics.isLatePunchIn) {
      summary.latePunchIn++;
    }
    if (metrics.isHalfDay) {
      summary.halfDay++;
    }
  }

  return summary;
}
