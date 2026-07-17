import { FeePaymentStatus, Role } from "@prisma/client";
import prisma from "../../lib/prisma.js";
import {
  buildFinancialYearMonths,
  formatFinancialYearLabel,
  getMonthsFrom,
  getMonthsThrough,
  isCurrentFyMonth,
  isMonthDue,
} from "./fee.financial-year.js";
import type { UpdateFeePaymentInput } from "./fee.schema.js";

export type FeePaymentCellStatus = "PAID" | "PARTIAL" | "UNPAID" | "UPCOMING";

export type FeePaymentCell = {
  status: FeePaymentCellStatus;
  amount: number;
  paymentDate: string | null;
};

export type FeeRegisterStudent = {
  id: string;
  name: string;
  rollNumber: string;
  classId: string;
  className: string;
  monthlyFee: number;
  payments: Record<number, FeePaymentCell>;
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
  payments: Record<number, FeePaymentCell>;
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

type PaymentRecord = {
  status: FeePaymentStatus;
  amount: number;
  paymentDate: Date | null;
  updatedAt: Date;
};

function toCellStatus(status: FeePaymentStatus | undefined): FeePaymentCellStatus {
  if (status === FeePaymentStatus.PAID) {
    return "PAID";
  }
  if (status === FeePaymentStatus.PARTIAL) {
    return "PARTIAL";
  }
  return "UNPAID";
}

function resolvePaymentDate(
  status: FeePaymentCellStatus,
  record: PaymentRecord | undefined,
): string | null {
  if (status !== "PAID" && status !== "PARTIAL") {
    return null;
  }

  const date = record?.paymentDate ?? record?.updatedAt;
  return date ? date.toISOString() : null;
}

function toPaymentCell(
  record: PaymentRecord | undefined,
): FeePaymentCell {
  const status = toCellStatus(record?.status);
  return {
    status,
    amount: record?.amount ?? 0,
    paymentDate: resolvePaymentDate(status, record),
  };
}

function buildPaymentMap(
  student: StudentWithClass,
  financialYearStart: number,
  paymentRecords: Map<string, PaymentRecord>,
  today: Date,
): Record<number, FeePaymentCell> {
  const payments: Record<number, FeePaymentCell> = {};

  for (const { month } of buildFinancialYearMonths(financialYearStart)) {
    const key = `${student.id}:${financialYearStart}:${month}`;

    if (!isMonthDue(financialYearStart, month, today)) {
      payments[month] = { status: "UPCOMING", amount: 0, paymentDate: null };
      continue;
    }

    payments[month] = toPaymentCell(paymentRecords.get(key));
  }

  return payments;
}

function buildDetailedPaymentMap(
  student: StudentWithClass,
  financialYearStart: number,
  paymentRecords: Map<string, PaymentRecord>,
  today: Date,
): Record<number, FeePaymentCell> {
  const payments: Record<number, FeePaymentCell> = {};

  for (const { month } of buildFinancialYearMonths(financialYearStart)) {
    const key = `${student.id}:${financialYearStart}:${month}`;

    if (!isMonthDue(financialYearStart, month, today)) {
      payments[month] = { status: "UPCOMING", amount: 0, paymentDate: null };
      continue;
    }

    payments[month] = toPaymentCell(paymentRecords.get(key));
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
): Promise<Map<string, PaymentRecord>> {
  if (studentIds.length === 0) {
    return new Map();
  }

  const records = await prisma.studentFeePayment.findMany({
    where: {
      financialYearStart,
      studentId: { in: studentIds },
    },
    select: {
      studentId: true,
      month: true,
      status: true,
      amount: true,
      paymentDate: true,
      updatedAt: true,
    },
  });

  return new Map(
    records.map((record) => [
      `${record.studentId}:${financialYearStart}:${record.month}`,
      {
        status: record.status,
        amount: record.amount,
        paymentDate: record.paymentDate,
        updatedAt: record.updatedAt,
      },
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
  monthlyFee: number,
  cell: FeePaymentCell,
) {
  const existing = summaries.get(month) ?? {
    month,
    label,
    collected: 0,
    due: 0,
    upcomingCount: 0,
  };

  if (cell.status === "UPCOMING") {
    existing.upcomingCount += 1;
  } else {
    existing.collected += cell.amount;
    existing.due += monthlyFee - cell.amount;
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

    for (const { month } of months) {
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

        const monthTotal = classMonthTotals[month]!;
        if (cell.status === "UPCOMING") {
          monthTotal.upcomingCount += 1;
        } else {
          const dueAmount = student.class.monthlyFee - cell.amount;
          monthTotal.collected += cell.amount;
          monthTotal.due += dueAmount;
          classCollected += cell.amount;
          if (!isCurrentFyMonth(financialYearStart, month, today)) {
            classDue += dueAmount;
          }
        }

        accumulateMonthSummary(
          monthSummaries,
          month,
          label,
          student.class.monthlyFee,
          cell,
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

  const monthlyFee = student.class.monthlyFee;

  if (input.amount > monthlyFee) {
    throw new FeeError(
      `Amount cannot exceed the monthly fee of ${monthlyFee}`,
      400,
    );
  }

  let monthsToUpdate: number[];
  let status: FeePaymentStatus;
  let storedAmount: number;
  let paymentDate: Date | null;

  if (input.amount >= monthlyFee) {
    monthsToUpdate = getMonthsThrough(input.month);
    status = FeePaymentStatus.PAID;
    storedAmount = monthlyFee;
    paymentDate = new Date();
  } else if (input.amount > 0) {
    monthsToUpdate = [input.month];
    status = FeePaymentStatus.PARTIAL;
    storedAmount = input.amount;
    paymentDate = new Date();
  } else {
    monthsToUpdate = getMonthsFrom(input.month);
    status = FeePaymentStatus.UNPAID;
    storedAmount = 0;
    paymentDate = null;
  }

  if (monthsToUpdate.length === 0) {
    throw new FeeError("Invalid month for financial year", 400);
  }

  await prisma.$transaction(async (tx) => {
    const existingRecords = await tx.studentFeePayment.findMany({
      where: {
        studentId: input.studentId,
        financialYearStart: input.financialYearStart,
        month: { in: monthsToUpdate },
      },
      select: {
        id: true,
        month: true,
        status: true,
        paymentDate: true,
      },
    });

    const existingByMonth = new Map(
      existingRecords.map((record) => [record.month, record]),
    );

    for (const month of monthsToUpdate) {
      const existing = existingByMonth.get(month);

      // Already-paid prior months keep their original payment data.
      if (
        status === FeePaymentStatus.PAID &&
        month !== input.month &&
        existing?.status === FeePaymentStatus.PAID
      ) {
        continue;
      }

      if (!existing) {
        await tx.studentFeePayment.create({
          data: {
            studentId: input.studentId,
            financialYearStart: input.financialYearStart,
            month,
            status,
            amount: storedAmount,
            paymentDate,
            updatedById: updatedByUserId,
          },
        });
        continue;
      }

      // Preserve an existing paymentDate; only set one when missing (or clear on unpaid).
      const nextPaymentDate =
        status === FeePaymentStatus.UNPAID
          ? null
          : (existing.paymentDate ?? paymentDate);

      await tx.studentFeePayment.update({
        where: { id: existing.id },
        data: {
          status,
          amount: storedAmount,
          paymentDate: nextPaymentDate,
          updatedById: updatedByUserId,
        },
      });
    }
  });
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
