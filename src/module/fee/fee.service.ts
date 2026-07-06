import { FeePaymentStatus, Role } from "@prisma/client";
import prisma from "../../lib/prisma.js";
import {
  buildFinancialYearMonths,
  formatFinancialYearLabel,
  getMonthsFrom,
  getMonthsThrough,
  isMonthDue,
} from "./fee.financial-year.js";
import type { UpdateFeePaymentInput } from "./fee.schema.js";

export type FeePaymentCellStatus = "PAID" | "UNPAID" | "UPCOMING";

export type FeeRegisterStudent = {
  id: string;
  name: string;
  rollNumber: string;
  classId: string;
  className: string;
  monthlyFee: number;
  payments: Record<number, FeePaymentCellStatus>;
};

export type FeeRegisterDto = {
  financialYearStart: number;
  financialYearLabel: string;
  months: { month: number; label: string; calendarYear: number }[];
  students: FeeRegisterStudent[];
  classes: { id: string; className: string; monthlyFee: number }[];
};

export type FeeReportMonthSummary = {
  month: number;
  label: string;
  collected: number;
  due: number;
  upcomingCount: number;
};

export type FeeReportStudentRow = {
  id: string;
  name: string;
  rollNumber: string;
  monthlyFee: number;
  payments: Record<
    number,
    { status: FeePaymentCellStatus; amount: number }
  >;
};

export type FeeReportClassBreakdown = {
  classId: string;
  className: string;
  monthlyFee: number;
  students: FeeReportStudentRow[];
  monthTotals: Record<
    number,
    { collected: number; due: number; upcomingCount: number }
  >;
  totalCollected: number;
  totalDue: number;
};

export type FeeReportDto = {
  financialYearStart: number;
  financialYearLabel: string;
  months: { month: number; label: string; calendarYear: number }[];
  summary: {
    totalCollected: number;
    totalDue: number;
    monthSummaries: FeeReportMonthSummary[];
  };
  classes: FeeReportClassBreakdown[];
};

type StudentWithClass = {
  id: string;
  studentRollNumber: string;
  classId: string;
  user: { name: string };
  class: { id: string; className: string; monthlyFee: number };
};

function buildPaymentMap(
  student: StudentWithClass,
  financialYearStart: number,
  paymentRecords: Map<string, { status: FeePaymentStatus; amount: number }>,
  today: Date,
): Record<number, FeePaymentCellStatus> {
  const payments: Record<number, FeePaymentCellStatus> = {};

  for (const { month } of buildFinancialYearMonths(financialYearStart)) {
    const key = `${student.id}:${financialYearStart}:${month}`;

    if (!isMonthDue(financialYearStart, month, today)) {
      payments[month] = "UPCOMING";
      continue;
    }

    const record = paymentRecords.get(key);
    payments[month] =
      record?.status === FeePaymentStatus.PAID ? "PAID" : "UNPAID";
  }

  return payments;
}

function buildDetailedPaymentMap(
  student: StudentWithClass,
  financialYearStart: number,
  paymentRecords: Map<string, { status: FeePaymentStatus; amount: number }>,
  today: Date,
): Record<number, { status: FeePaymentCellStatus; amount: number }> {
  const payments: Record<
    number,
    { status: FeePaymentCellStatus; amount: number }
  > = {};

  for (const { month } of buildFinancialYearMonths(financialYearStart)) {
    const key = `${student.id}:${financialYearStart}:${month}`;
    const record = paymentRecords.get(key);
    const feeAmount = student.class.monthlyFee;

    if (!isMonthDue(financialYearStart, month, today)) {
      payments[month] = { status: "UPCOMING", amount: feeAmount };
      continue;
    }

    const status: FeePaymentCellStatus =
      record?.status === FeePaymentStatus.PAID ? "PAID" : "UNPAID";

    payments[month] = {
      status,
      amount: record?.amount ?? feeAmount,
    };
  }

  return payments;
}

async function loadStudents(classId?: string): Promise<StudentWithClass[]> {
  return prisma.studentDetail.findMany({
    ...(classId ? { where: { classId } } : {}),
    include: {
      user: { select: { name: true } },
      class: { select: { id: true, className: true, monthlyFee: true } },
    },
    orderBy: [{ class: { className: "asc" } }, { studentRollNumber: "asc" }],
  });
}

async function loadPaymentRecords(
  financialYearStart: number,
  studentIds: string[],
): Promise<Map<string, { status: FeePaymentStatus; amount: number }>> {
  if (studentIds.length === 0) {
    return new Map();
  }

  const records = await prisma.studentFeePayment.findMany({
    where: {
      financialYearStart,
      studentId: { in: studentIds },
    },
    select: { studentId: true, month: true, status: true, amount: true },
  });

  return new Map(
    records.map((record) => [
      `${record.studentId}:${financialYearStart}:${record.month}`,
      { status: record.status, amount: record.amount },
    ]),
  );
}

async function loadClasses() {
  return prisma.class.findMany({
    select: { id: true, className: true, monthlyFee: true },
    orderBy: { className: "asc" },
  });
}

export async function getFeeRegister(
  financialYearStart: number,
  classId?: string,
): Promise<FeeRegisterDto> {
  const today = new Date();
  const students = await loadStudents(classId);
  const paymentRecords = await loadPaymentRecords(
    financialYearStart,
    students.map((student) => student.id),
  );
  const classes = await loadClasses();

  return {
    financialYearStart,
    financialYearLabel: formatFinancialYearLabel(financialYearStart),
    months: buildFinancialYearMonths(financialYearStart),
    classes,
    students: students.map((student) => ({
      id: student.id,
      name: student.user.name,
      rollNumber: student.studentRollNumber,
      classId: student.classId,
      className: student.class.className,
      monthlyFee: student.class.monthlyFee,
      payments: buildPaymentMap(
        student,
        financialYearStart,
        paymentRecords,
        today,
      ),
    })),
  };
}

function accumulateMonthSummary(
  summaries: Map<number, FeeReportMonthSummary>,
  month: number,
  label: string,
  status: FeePaymentCellStatus,
  amount: number,
) {
  const existing = summaries.get(month) ?? {
    month,
    label,
    collected: 0,
    due: 0,
    upcomingCount: 0,
  };

  if (status === "PAID") {
    existing.collected += amount;
  } else if (status === "UNPAID") {
    existing.due += amount;
  } else {
    existing.upcomingCount += 1;
  }

  summaries.set(month, existing);
}

export async function getFeeReport(
  financialYearStart: number,
): Promise<FeeReportDto> {
  const today = new Date();
  const months = buildFinancialYearMonths(financialYearStart);
  const students = await loadStudents();
  const paymentRecords = await loadPaymentRecords(
    financialYearStart,
    students.map((student) => student.id),
  );
  const classes = await loadClasses();

  const monthSummaries = new Map<number, FeeReportMonthSummary>();
  let totalCollected = 0;
  let totalDue = 0;

  const classBreakdowns: FeeReportClassBreakdown[] = classes.map((cls) => {
    const classStudents = students.filter((student) => student.classId === cls.id);
    const classMonthTotals: FeeReportClassBreakdown["monthTotals"] = {};

    for (const { month, label } of months) {
      classMonthTotals[month] = { collected: 0, due: 0, upcomingCount: 0 };
    }

    let classCollected = 0;
    let classDue = 0;

    const studentRows: FeeReportStudentRow[] = classStudents.map((student) => {
      const payments = buildDetailedPaymentMap(
        student,
        financialYearStart,
        paymentRecords,
        today,
      );

      for (const { month, label } of months) {
        const cell = payments[month];
        if (!cell) {
          continue;
        }

        if (cell.status === "PAID") {
          const monthTotal = classMonthTotals[month]!;
          monthTotal.collected += cell.amount;
          classCollected += cell.amount;
        } else if (cell.status === "UNPAID") {
          const monthTotal = classMonthTotals[month]!;
          monthTotal.due += cell.amount;
          classDue += cell.amount;
        } else {
          classMonthTotals[month]!.upcomingCount += 1;
        }

        accumulateMonthSummary(
          monthSummaries,
          month,
          label,
          cell.status,
          cell.amount,
        );
      }

      return {
        id: student.id,
        name: student.user.name,
        rollNumber: student.studentRollNumber,
        monthlyFee: student.class.monthlyFee,
        payments,
      };
    });

    totalCollected += classCollected;
    totalDue += classDue;

    return {
      classId: cls.id,
      className: cls.className,
      monthlyFee: cls.monthlyFee,
      students: studentRows,
      monthTotals: classMonthTotals,
      totalCollected: classCollected,
      totalDue: classDue,
    };
  });

  return {
    financialYearStart,
    financialYearLabel: formatFinancialYearLabel(financialYearStart),
    months,
    summary: {
      totalCollected,
      totalDue,
      monthSummaries: months.map(
        ({ month, label }) =>
          monthSummaries.get(month) ?? {
            month,
            label,
            collected: 0,
            due: 0,
            upcomingCount: 0,
          },
      ),
    },
    classes: classBreakdowns,
  };
}

export async function updateFeePayment(
  input: UpdateFeePaymentInput,
  updatedByUserId: string,
): Promise<void> {
  const student = await prisma.studentDetail.findUnique({
    where: { id: input.studentId },
    include: { class: { select: { monthlyFee: true } } },
  });

  if (!student) {
    throw new FeeError("Student not found", 404);
  }

  const monthsToUpdate =
    input.status === "PAID"
      ? getMonthsThrough(input.month)
      : getMonthsFrom(input.month);

  if (monthsToUpdate.length === 0) {
    throw new FeeError("Invalid month for financial year", 400);
  }

  const status =
    input.status === "PAID" ? FeePaymentStatus.PAID : FeePaymentStatus.UNPAID;
  const amount = student.class.monthlyFee;

  await prisma.$transaction(
    monthsToUpdate.map((month) =>
      prisma.studentFeePayment.upsert({
        where: {
          studentId_financialYearStart_month: {
            studentId: input.studentId,
            financialYearStart: input.financialYearStart,
            month,
          },
        },
        create: {
          studentId: input.studentId,
          financialYearStart: input.financialYearStart,
          month,
          status,
          amount,
          updatedById: updatedByUserId,
        },
        update: {
          status,
          amount,
          updatedById: updatedByUserId,
        },
      }),
    ),
  );
}

export async function assertFeeCollector(userId: string, role: Role) {
  if (role === Role.ADMIN || role === Role.TEACHER) {
    return;
  }

  throw new FeeError("Forbidden", 403);
}

export class FeeError extends Error {
  constructor(
    message: string,
    public statusCode: number,
  ) {
    super(message);
    this.name = "FeeError";
  }
}
