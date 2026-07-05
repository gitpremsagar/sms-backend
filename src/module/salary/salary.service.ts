import { Role } from "@prisma/client";
import prisma from "../../lib/prisma.js";
import { getRegister, getRegisterForTeacher } from "../attendance/attendance.service.js";
import {
  computeSalaryBreakdown,
  type SalaryBreakdown,
} from "./salary.calculate.js";

export type { SalaryBreakdown };

export type SalaryRegisterDto = {
  breakdowns: SalaryBreakdown[];
  year: number;
  month: number;
};

async function getTeacherSalaries(
  teacherIds: string[],
): Promise<Map<string, number>> {
  if (teacherIds.length === 0) {
    return new Map();
  }

  const details = await prisma.teacherDetail.findMany({
    where: { id: { in: teacherIds } },
    select: { id: true, monthlySalary: true },
  });

  return new Map(details.map((detail) => [detail.id, detail.monthlySalary]));
}

function buildBreakdownsFromRegister(
  register: Awaited<ReturnType<typeof getRegister>>,
  salaryByTeacher: Map<string, number>,
): SalaryBreakdown[] {
  return register.teachers.map((teacher) =>
    computeSalaryBreakdown({
      teacherId: teacher.id,
      name: teacher.name,
      employeeId: teacher.employeeId,
      monthlySalary: salaryByTeacher.get(teacher.id) ?? 0,
      schedule: {
        workStartTime: teacher.workStartTime,
        workEndTime: teacher.workEndTime,
        halfDayThresholdTime: teacher.halfDayThresholdTime,
      },
      records: register.records,
      year: register.year,
      month: register.month,
      daysInMonth: register.daysInMonth,
      holidays: register.holidays,
    }),
  );
}

export async function getSalaryRegister(
  year: number,
  month: number,
): Promise<SalaryRegisterDto> {
  const register = await getRegister(year, month);
  const salaryByTeacher = await getTeacherSalaries(
    register.teachers.map((teacher) => teacher.id),
  );

  return {
    breakdowns: buildBreakdownsFromRegister(register, salaryByTeacher),
    year,
    month,
  };
}

export async function getSalaryForTeacher(
  userId: string,
  year: number,
  month: number,
): Promise<SalaryBreakdown> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { teacherDetail: true },
  });

  if (!user?.teacherDetail || user.role !== Role.TEACHER) {
    throw new SalaryError("Teacher profile not found", 404);
  }

  const register = await getRegisterForTeacher(userId, year, month);
  const breakdowns = buildBreakdownsFromRegister(
    register,
    new Map([[user.teacherDetail.id, user.teacherDetail.monthlySalary]]),
  );

  const breakdown = breakdowns[0];
  if (!breakdown) {
    throw new SalaryError("Salary breakdown not found", 404);
  }

  return breakdown;
}

export class SalaryError extends Error {
  constructor(
    message: string,
    public statusCode: number,
  ) {
    super(message);
    this.name = "SalaryError";
  }
}
