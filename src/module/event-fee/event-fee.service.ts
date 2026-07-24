import {
  ClassKind,
  EventFeeKind,
  FeePaymentStatus,
} from "@prisma/client";
import prisma from "../../lib/prisma.js";
import {
  formatFinancialYearLabel,
} from "../fee/fee.financial-year.js";
import type {
  CreateEventFeeInput,
  UpdateEventFeeInput,
  UpdateEventFeePaymentInput,
} from "./event-fee.schema.js";

export class EventFeeError extends Error {
  statusCode: number;

  constructor(message: string, statusCode = 400) {
    super(message);
    this.name = "EventFeeError";
    this.statusCode = statusCode;
  }
}

export type EventFeeClassRateDto = {
  classId: string;
  className: string;
  classKind: ClassKind;
  amount: number;
};

export type EventFeeDto = {
  id: string;
  title: string;
  kind: EventFeeKind;
  financialYearStart: number;
  financialYearLabel: string;
  dueDate: string | null;
  notes: string | null;
  classRates: EventFeeClassRateDto[];
  paymentCount: number;
  createdAt: string;
  updatedAt: string;
};

export type EventFeePaymentCellStatus = "PAID" | "UNPAID";

export type EventFeePaymentCell = {
  status: EventFeePaymentCellStatus;
  amount: number;
  dueAmount: number;
  paymentDate: string | null;
};

export type EventFeeRegisterEvent = {
  id: string;
  title: string;
  kind: EventFeeKind;
  dueDate: string | null;
};

export type EventFeeRegisterStudent = {
  id: string;
  name: string;
  rollNumber: string;
  classId: string;
  className: string;
  classKind: ClassKind;
  payments: Record<string, EventFeePaymentCell | null>;
};

export type EventFeeRegisterDto = {
  financialYearStart: number;
  financialYearLabel: string;
  events: EventFeeRegisterEvent[];
  students: EventFeeRegisterStudent[];
  classes: {
    id: string;
    className: string;
    kind: ClassKind;
  }[];
  eventsMeta: Record<string, { classRates: Record<string, number> }>;
};

export type EventFeeReportEventSummary = {
  eventFeeId: string;
  title: string;
  kind: EventFeeKind;
  collected: number;
  due: number;
  unpaidCount: number;
  paidCount: number;
};

export type EventFeeReportStudentRow = {
  id: string;
  name: string;
  rollNumber: string;
  payments: Record<string, EventFeePaymentCell | null>;
};

export type EventFeeReportClassBreakdown = {
  classId: string;
  className: string;
  students: EventFeeReportStudentRow[];
  eventTotals: Record<string, { collected: number; due: number }>;
  totalCollected: number;
  totalDue: number;
};

export type EventFeeReportDto = {
  financialYearStart: number;
  financialYearLabel: string;
  events: EventFeeRegisterEvent[];
  summary: {
    totalCollected: number;
    totalDue: number;
    eventSummaries: EventFeeReportEventSummary[];
  };
  classes: EventFeeReportClassBreakdown[];
};

function toIsoDate(value: Date | null | undefined): string | null {
  return value ? value.toISOString() : null;
}

function mapEventFeeDto(event: {
  id: string;
  title: string;
  kind: EventFeeKind;
  financialYearStart: number;
  dueDate: Date | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
  classRates: {
    classId: string;
    amount: number;
    class: { className: string; kind: ClassKind };
  }[];
  _count: { payments: number };
}): EventFeeDto {
  return {
    id: event.id,
    title: event.title,
    kind: event.kind,
    financialYearStart: event.financialYearStart,
    financialYearLabel: formatFinancialYearLabel(event.financialYearStart),
    dueDate: toIsoDate(event.dueDate),
    notes: event.notes,
    classRates: event.classRates
      .map((rate) => ({
        classId: rate.classId,
        className: rate.class.className,
        classKind: rate.class.kind,
        amount: rate.amount,
      }))
      .sort((a, b) => a.className.localeCompare(b.className)),
    paymentCount: event._count.payments,
    createdAt: event.createdAt.toISOString(),
    updatedAt: event.updatedAt.toISOString(),
  };
}

const eventFeeInclude = {
  classRates: {
    include: {
      class: { select: { className: true, kind: true } },
    },
  },
  _count: { select: { payments: true } },
};

async function assertValidClassIds(classIds: string[]): Promise<void> {
  const uniqueIds = [...new Set(classIds)];
  const classes = await prisma.class.findMany({
    where: { id: { in: uniqueIds } },
    select: { id: true },
  });

  if (classes.length !== uniqueIds.length) {
    throw new EventFeeError("One or more classes were not found", 400);
  }
}

function parseDueDate(value: string | null | undefined): Date | null {
  if (value === undefined || value === null || value === "") {
    return null;
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return new Date(`${value}T00:00:00.000Z`);
  }
  return new Date(value);
}

export async function listEventFees(
  financialYearStart: number,
): Promise<EventFeeDto[]> {
  const events = await prisma.eventFee.findMany({
    where: { financialYearStart },
    include: eventFeeInclude,
    orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
  });

  return events.map(mapEventFeeDto);
}

export async function getEventFeeById(id: string): Promise<EventFeeDto> {
  const event = await prisma.eventFee.findUnique({
    where: { id },
    include: eventFeeInclude,
  });

  if (!event) {
    throw new EventFeeError("Event fee not found", 404);
  }

  return mapEventFeeDto(event);
}

export async function createEventFee(
  input: CreateEventFeeInput,
): Promise<EventFeeDto> {
  const classIds = input.classRates.map((rate) => rate.classId);
  if (new Set(classIds).size !== classIds.length) {
    throw new EventFeeError("Duplicate class rates are not allowed", 400);
  }

  await assertValidClassIds(classIds);

  const event = await prisma.eventFee.create({
    data: {
      title: input.title,
      kind: input.kind,
      financialYearStart: input.financialYearStart,
      dueDate: parseDueDate(input.dueDate),
      notes: input.notes ?? null,
      classRates: {
        create: input.classRates.map((rate) => ({
          classId: rate.classId,
          amount: rate.amount,
        })),
      },
    },
    include: eventFeeInclude,
  });

  return mapEventFeeDto(event);
}

export async function updateEventFee(
  id: string,
  input: UpdateEventFeeInput,
): Promise<EventFeeDto> {
  const existing = await prisma.eventFee.findUnique({
    where: { id },
    select: { id: true },
  });

  if (!existing) {
    throw new EventFeeError("Event fee not found", 404);
  }

  const classIds = input.classRates.map((rate) => rate.classId);
  if (new Set(classIds).size !== classIds.length) {
    throw new EventFeeError("Duplicate class rates are not allowed", 400);
  }

  await assertValidClassIds(classIds);

  const event = await prisma.$transaction(async (tx) => {
    await tx.eventFeeClassRate.deleteMany({ where: { eventFeeId: id } });

    return tx.eventFee.update({
      where: { id },
      data: {
        title: input.title,
        kind: input.kind,
        financialYearStart: input.financialYearStart,
        dueDate: parseDueDate(input.dueDate),
        notes: input.notes ?? null,
        classRates: {
          create: input.classRates.map((rate) => ({
            classId: rate.classId,
            amount: rate.amount,
          })),
        },
      },
      include: eventFeeInclude,
    });
  });

  return mapEventFeeDto(event);
}

export async function deleteEventFee(id: string): Promise<void> {
  const event = await prisma.eventFee.findUnique({
    where: { id },
    include: { _count: { select: { payments: true } } },
  });

  if (!event) {
    throw new EventFeeError("Event fee not found", 404);
  }

  if (event._count.payments > 0) {
    throw new EventFeeError(
      "Cannot delete an event that already has payment records",
      400,
    );
  }

  await prisma.$transaction(async (tx) => {
    await tx.eventFeeClassRate.deleteMany({ where: { eventFeeId: id } });
    await tx.eventFee.delete({ where: { id } });
  });
}

function buildPaymentCell(
  classRate: number | undefined,
  payment:
    | {
        status: FeePaymentStatus;
        amount: number;
        paymentDate: Date | null;
      }
    | undefined,
): EventFeePaymentCell | null {
  if (classRate === undefined) {
    return null;
  }

  if (payment?.status === FeePaymentStatus.PAID) {
    return {
      status: "PAID",
      amount: payment.amount,
      dueAmount: 0,
      paymentDate: toIsoDate(payment.paymentDate),
    };
  }

  return {
    status: "UNPAID",
    amount: payment?.amount ?? 0,
    dueAmount: classRate,
    paymentDate: null,
  };
}

export async function getEventFeeRegister(
  financialYearStart: number,
  eventFeeId?: string,
  classId?: string,
): Promise<EventFeeRegisterDto> {
  const events = await prisma.eventFee.findMany({
    where: {
      financialYearStart,
      ...(eventFeeId ? { id: eventFeeId } : {}),
    },
    include: {
      classRates: {
        select: { classId: true, amount: true },
      },
    },
    orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
  });

  const eventIds = events.map((event) => event.id);
  const liableClassIds = new Set(
    events.flatMap((event) => event.classRates.map((rate) => rate.classId)),
  );

  const eventsMeta: EventFeeRegisterDto["eventsMeta"] = {};
  for (const event of events) {
    eventsMeta[event.id] = {
      classRates: Object.fromEntries(
        event.classRates.map((rate) => [rate.classId, rate.amount]),
      ),
    };
  }

  const emptyRegister = (): EventFeeRegisterDto => ({
    financialYearStart,
    financialYearLabel: formatFinancialYearLabel(financialYearStart),
    events: events.map((event) => ({
      id: event.id,
      title: event.title,
      kind: event.kind,
      dueDate: toIsoDate(event.dueDate),
    })),
    students: [],
    classes: [],
    eventsMeta,
  });

  if (eventIds.length === 0 || (liableClassIds.size === 0 && !classId)) {
    return emptyRegister();
  }

  const students = await prisma.studentDetail.findMany({
    where: {
      isStudying: true,
      ...(classId
        ? { classId }
        : { classId: { in: [...liableClassIds] } }),
    },
    select: {
      id: true,
      studentRollNumber: true,
      classId: true,
      user: { select: { name: true } },
      class: { select: { id: true, className: true, kind: true } },
    },
    orderBy: [{ studentRollNumber: "asc" }],
  });

  students.sort((a, b) => {
    const classCompare = a.class.className.localeCompare(b.class.className);
    if (classCompare !== 0) {
      return classCompare;
    }
    return a.studentRollNumber.localeCompare(b.studentRollNumber);
  });

  const payments =
    students.length === 0
      ? []
      : await prisma.eventFeePayment.findMany({
          where: {
            eventFeeId: { in: eventIds },
            studentId: { in: students.map((student) => student.id) },
          },
          select: {
            eventFeeId: true,
            studentId: true,
            status: true,
            amount: true,
            paymentDate: true,
          },
        });

  const paymentMap = new Map(
    payments.map((payment) => [
      `${payment.eventFeeId}:${payment.studentId}`,
      payment,
    ]),
  );

  const classesMap = new Map<
    string,
    { id: string; className: string; kind: ClassKind }
  >();

  const registerStudents: EventFeeRegisterStudent[] = students.map(
    (student) => {
      classesMap.set(student.classId, {
        id: student.class.id,
        className: student.class.className,
        kind: student.class.kind,
      });

      const studentPayments: Record<string, EventFeePaymentCell | null> = {};
      for (const event of events) {
        const classRate = eventsMeta[event.id]?.classRates[student.classId];
        const payment = paymentMap.get(`${event.id}:${student.id}`);
        studentPayments[event.id] = buildPaymentCell(classRate, payment);
      }

      return {
        id: student.id,
        name: student.user.name,
        rollNumber: student.studentRollNumber,
        classId: student.classId,
        className: student.class.className,
        classKind: student.class.kind,
        payments: studentPayments,
      };
    },
  );

  return {
    financialYearStart,
    financialYearLabel: formatFinancialYearLabel(financialYearStart),
    events: events.map((event) => ({
      id: event.id,
      title: event.title,
      kind: event.kind,
      dueDate: toIsoDate(event.dueDate),
    })),
    students: registerStudents,
    classes: [...classesMap.values()].sort((a, b) =>
      a.className.localeCompare(b.className),
    ),
    eventsMeta,
  };
}

export async function getEventFeeReport(
  financialYearStart: number,
): Promise<EventFeeReportDto> {
  const events = await prisma.eventFee.findMany({
    where: { financialYearStart },
    include: {
      classRates: {
        select: { classId: true, amount: true },
      },
    },
    orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
  });

  const eventIds = events.map((event) => event.id);
  const liableClassIds = new Set(
    events.flatMap((event) => event.classRates.map((rate) => rate.classId)),
  );

  const eventSummaries: EventFeeReportEventSummary[] = events.map((event) => ({
    eventFeeId: event.id,
    title: event.title,
    kind: event.kind,
    collected: 0,
    due: 0,
    unpaidCount: 0,
    paidCount: 0,
  }));

  if (eventIds.length === 0 || liableClassIds.size === 0) {
    return {
      financialYearStart,
      financialYearLabel: formatFinancialYearLabel(financialYearStart),
      events: events.map((event) => ({
        id: event.id,
        title: event.title,
        kind: event.kind,
        dueDate: toIsoDate(event.dueDate),
      })),
      summary: {
        totalCollected: 0,
        totalDue: 0,
        eventSummaries,
      },
      classes: [],
    };
  }

  const students = await prisma.studentDetail.findMany({
    where: {
      isStudying: true,
      classId: { in: [...liableClassIds] },
    },
    select: {
      id: true,
      studentRollNumber: true,
      classId: true,
      user: { select: { name: true } },
      class: { select: { id: true, className: true } },
    },
    orderBy: [{ studentRollNumber: "asc" }],
  });

  students.sort((a, b) => {
    const classCompare = a.class.className.localeCompare(b.class.className);
    if (classCompare !== 0) {
      return classCompare;
    }
    return a.studentRollNumber.localeCompare(b.studentRollNumber);
  });

  const payments =
    students.length === 0
      ? []
      : await prisma.eventFeePayment.findMany({
          where: {
            eventFeeId: { in: eventIds },
            studentId: { in: students.map((student) => student.id) },
          },
          select: {
            eventFeeId: true,
            studentId: true,
            status: true,
            amount: true,
            paymentDate: true,
          },
        });

  const paymentMap = new Map(
    payments.map((payment) => [
      `${payment.eventFeeId}:${payment.studentId}`,
      payment,
    ]),
  );

  const eventsMeta = new Map(
    events.map((event) => [
      event.id,
      Object.fromEntries(
        event.classRates.map((rate) => [rate.classId, rate.amount]),
      ) as Record<string, number>,
    ]),
  );

  const eventSummaryMap = new Map(
    eventSummaries.map((summary) => [summary.eventFeeId, summary]),
  );

  const classMap = new Map<
    string,
    {
      classId: string;
      className: string;
      students: EventFeeReportStudentRow[];
      eventTotals: Record<string, { collected: number; due: number }>;
      totalCollected: number;
      totalDue: number;
    }
  >();

  let totalCollected = 0;
  let totalDue = 0;

  for (const student of students) {
    let classBreakdown = classMap.get(student.classId);
    if (!classBreakdown) {
      const eventTotals: Record<string, { collected: number; due: number }> =
        {};
      for (const event of events) {
        eventTotals[event.id] = { collected: 0, due: 0 };
      }
      classBreakdown = {
        classId: student.classId,
        className: student.class.className,
        students: [],
        eventTotals,
        totalCollected: 0,
        totalDue: 0,
      };
      classMap.set(student.classId, classBreakdown);
    }

    const studentPayments: Record<string, EventFeePaymentCell | null> = {};

    for (const event of events) {
      const classRate = eventsMeta.get(event.id)?.[student.classId];
      const payment = paymentMap.get(`${event.id}:${student.id}`);
      const cell = buildPaymentCell(classRate, payment);
      studentPayments[event.id] = cell;

      if (!cell) {
        continue;
      }

      const summary = eventSummaryMap.get(event.id);
      const eventTotal = classBreakdown.eventTotals[event.id];

      if (cell.status === "PAID") {
        totalCollected += cell.amount;
        classBreakdown.totalCollected += cell.amount;
        if (summary) {
          summary.collected += cell.amount;
          summary.paidCount += 1;
        }
        if (eventTotal) {
          eventTotal.collected += cell.amount;
        }
      } else {
        totalDue += cell.dueAmount;
        classBreakdown.totalDue += cell.dueAmount;
        if (summary) {
          summary.due += cell.dueAmount;
          summary.unpaidCount += 1;
        }
        if (eventTotal) {
          eventTotal.due += cell.dueAmount;
        }
      }
    }

    classBreakdown.students.push({
      id: student.id,
      name: student.user.name,
      rollNumber: student.studentRollNumber,
      payments: studentPayments,
    });
  }

  return {
    financialYearStart,
    financialYearLabel: formatFinancialYearLabel(financialYearStart),
    events: events.map((event) => ({
      id: event.id,
      title: event.title,
      kind: event.kind,
      dueDate: toIsoDate(event.dueDate),
    })),
    summary: {
      totalCollected,
      totalDue,
      eventSummaries,
    },
    classes: [...classMap.values()].sort((a, b) =>
      a.className.localeCompare(b.className),
    ),
  };
}

export async function updateEventFeePayment(
  input: UpdateEventFeePaymentInput,
  updatedByUserId: string,
): Promise<void> {
  const [event, student] = await Promise.all([
    prisma.eventFee.findUnique({
      where: { id: input.eventFeeId },
      include: {
        classRates: { select: { classId: true, amount: true } },
      },
    }),
    prisma.studentDetail.findUnique({
      where: { id: input.studentId },
      select: { id: true, classId: true, isStudying: true },
    }),
  ]);

  if (!event) {
    throw new EventFeeError("Event fee not found", 404);
  }

  if (!student) {
    throw new EventFeeError("Student not found", 404);
  }

  if (!student.isStudying) {
    throw new EventFeeError("Student is not currently studying", 400);
  }

  const classRate = event.classRates.find(
    (rate) => rate.classId === student.classId,
  );

  if (!classRate) {
    throw new EventFeeError(
      "Student's class is not included in this event fee",
      400,
    );
  }

  const existing = await prisma.eventFeePayment.findUnique({
    where: {
      eventFeeId_studentId: {
        eventFeeId: input.eventFeeId,
        studentId: input.studentId,
      },
    },
  });

  if (input.status === FeePaymentStatus.PAID) {
    const paymentDate = existing?.paymentDate ?? new Date();

    if (!existing) {
      await prisma.eventFeePayment.create({
        data: {
          eventFeeId: input.eventFeeId,
          studentId: input.studentId,
          status: FeePaymentStatus.PAID,
          amount: classRate.amount,
          paymentDate,
          updatedById: updatedByUserId,
        },
      });
      return;
    }

    await prisma.eventFeePayment.update({
      where: { id: existing.id },
      data: {
        status: FeePaymentStatus.PAID,
        amount: classRate.amount,
        paymentDate,
        updatedById: updatedByUserId,
      },
    });
    return;
  }

  if (!existing) {
    await prisma.eventFeePayment.create({
      data: {
        eventFeeId: input.eventFeeId,
        studentId: input.studentId,
        status: FeePaymentStatus.UNPAID,
        amount: 0,
        paymentDate: null,
        updatedById: updatedByUserId,
      },
    });
    return;
  }

  await prisma.eventFeePayment.update({
    where: { id: existing.id },
    data: {
      status: FeePaymentStatus.UNPAID,
      amount: 0,
      paymentDate: null,
      updatedById: updatedByUserId,
    },
  });
}
