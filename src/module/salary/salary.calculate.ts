import { AttendanceStatus } from "@prisma/client";
import {
  type TeacherSchedule,
  classifyDay,
} from "../attendance/attendance.classify.js";
import type { AttendanceRecordDto } from "../attendance/attendance.service.js";

export type SalaryBreakdown = {
  teacherId: string;
  name: string;
  employeeId: string | null;
  monthlySalary: number;
  workingDays: number;
  dailyRate: number;
  fullPresentDays: number;
  halfDays: number;
  absentDays: number;
  unmarkedDays: number;
  deductions: number;
  calculatedSalary: number;
};

function formatDate(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function recordKey(teacherId: string, date: string): string {
  return `${teacherId}:${date}`;
}

function roundCurrency(value: number): number {
  return Math.round(value * 100) / 100;
}

export function computeSalaryBreakdown(input: {
  teacherId: string;
  name: string;
  employeeId: string | null;
  monthlySalary: number;
  schedule: TeacherSchedule;
  records: Record<string, AttendanceRecordDto>;
  year: number;
  month: number;
  daysInMonth: number;
  holidays: string[];
}): SalaryBreakdown {
  const holidaySet = new Set(input.holidays);
  let workingDays = 0;
  let fullPresentDays = 0;
  let halfDays = 0;
  let explicitAbsentDays = 0;
  let unmarkedDays = 0;

  for (let day = 1; day <= input.daysInMonth; day++) {
    const date = formatDate(input.year, input.month, day);
    if (holidaySet.has(date)) {
      continue;
    }

    workingDays++;
    const record = input.records[recordKey(input.teacherId, date)];

    if (!record) {
      unmarkedDays++;
      continue;
    }

    if (record.status === AttendanceStatus.ABSENT) {
      explicitAbsentDays++;
      continue;
    }

    if (record.status === AttendanceStatus.IN_PROGRESS) {
      unmarkedDays++;
      continue;
    }

    const metrics = classifyDay(record, input.schedule, false);

    if (metrics.isAbsent) {
      explicitAbsentDays++;
    } else if (metrics.isHalfDay) {
      halfDays++;
    } else if (metrics.isPresent) {
      fullPresentDays++;
    } else {
      unmarkedDays++;
    }
  }

  const absentDays = explicitAbsentDays + unmarkedDays;
  const dailyRate =
    input.monthlySalary > 0 && workingDays > 0
      ? roundCurrency(input.monthlySalary / workingDays)
      : 0;
  const deductions = roundCurrency(
    absentDays * dailyRate + halfDays * 0.5 * dailyRate,
  );
  const calculatedSalary = roundCurrency(
    Math.max(0, input.monthlySalary - deductions),
  );

  return {
    teacherId: input.teacherId,
    name: input.name,
    employeeId: input.employeeId,
    monthlySalary: roundCurrency(input.monthlySalary),
    workingDays,
    dailyRate,
    fullPresentDays,
    halfDays,
    absentDays,
    unmarkedDays,
    deductions,
    calculatedSalary,
  };
}
