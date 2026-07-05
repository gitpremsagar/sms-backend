import bcrypt from "bcrypt";
import { Role } from "@prisma/client";
import prisma from "../../lib/prisma.js";
import type { CreateTeacherInput, UpdateTeacherInput } from "./teacher.schema.js";

export type TeacherDto = {
  id: string;
  userId: string;
  name: string;
  email: string;
  employeeId: string | null;
  phone: string | null;
  workStartTime: string;
  workEndTime: string;
  halfDayThresholdTime: string;
  monthlySalary: number;
  createdAt: string;
};

function toTeacherDto(user: {
  id: string;
  name: string;
  email: string;
  createdAt: Date;
  teacherDetail: {
    id: string;
    employeeId: string | null;
    phone: string | null;
    workStartTime: string;
    workEndTime: string;
    halfDayThresholdTime: string;
    monthlySalary: number;
  } | null;
}): TeacherDto {
  if (!user.teacherDetail) {
    throw new TeacherError("Teacher profile not found", 500);
  }

  return {
    id: user.teacherDetail.id,
    userId: user.id,
    name: user.name,
    email: user.email,
    employeeId: user.teacherDetail.employeeId,
    phone: user.teacherDetail.phone,
    workStartTime: user.teacherDetail.workStartTime,
    workEndTime: user.teacherDetail.workEndTime,
    halfDayThresholdTime: user.teacherDetail.halfDayThresholdTime,
    monthlySalary: user.teacherDetail.monthlySalary,
    createdAt: user.createdAt.toISOString(),
  };
}

export async function listTeachers(): Promise<TeacherDto[]> {
  const users = await prisma.user.findMany({
    where: { role: Role.TEACHER },
    include: { teacherDetail: true },
    orderBy: { createdAt: "desc" },
  });

  return users
    .filter((user) => user.teacherDetail)
    .map((user) => toTeacherDto(user));
}

export async function createTeacher(input: CreateTeacherInput): Promise<TeacherDto> {
  const existingUser = await prisma.user.findUnique({
    where: { email: input.email },
  });

  if (existingUser) {
    throw new TeacherError("A user with this email already exists", 409);
  }

  if (input.employeeId) {
    const existingEmployee = await prisma.teacherDetail.findUnique({
      where: { employeeId: input.employeeId },
    });

    if (existingEmployee) {
      throw new TeacherError("A teacher with this employee ID already exists", 409);
    }
  }

  const hashedPassword = await bcrypt.hash(input.password, 10);

  const user = await prisma.user.create({
    data: {
      name: input.name,
      email: input.email,
      password: hashedPassword,
      role: Role.TEACHER,
      teacherDetail: {
        create: {
          ...(input.employeeId ? { employeeId: input.employeeId } : {}),
          ...(input.phone ? { phone: input.phone } : {}),
          ...(input.workStartTime ? { workStartTime: input.workStartTime } : {}),
          ...(input.workEndTime ? { workEndTime: input.workEndTime } : {}),
          ...(input.halfDayThresholdTime
            ? { halfDayThresholdTime: input.halfDayThresholdTime }
            : {}),
          ...(input.monthlySalary !== undefined
            ? { monthlySalary: input.monthlySalary }
            : {}),
        },
      },
    },
    include: { teacherDetail: true },
  });

  return toTeacherDto(user);
}

export async function getTeacherById(id: string): Promise<TeacherDto> {
  const teacherDetail = await prisma.teacherDetail.findUnique({
    where: { id },
    include: { user: true },
  });

  if (!teacherDetail) {
    throw new TeacherError("Teacher not found", 404);
  }

  return toTeacherDto({
    ...teacherDetail.user,
    teacherDetail,
  });
}

export async function updateTeacher(
  id: string,
  input: UpdateTeacherInput,
): Promise<TeacherDto> {
  const teacherDetail = await prisma.teacherDetail.findUnique({
    where: { id },
    include: { user: true },
  });

  if (!teacherDetail) {
    throw new TeacherError("Teacher not found", 404);
  }

  if (input.email && input.email !== teacherDetail.user.email) {
    const existingUser = await prisma.user.findUnique({
      where: { email: input.email },
    });

    if (existingUser) {
      throw new TeacherError("A user with this email already exists", 409);
    }
  }

  if (
    input.employeeId !== undefined &&
    input.employeeId !== teacherDetail.employeeId
  ) {
    if (input.employeeId) {
      const existingEmployee = await prisma.teacherDetail.findUnique({
        where: { employeeId: input.employeeId },
      });

      if (existingEmployee && existingEmployee.id !== id) {
        throw new TeacherError("A teacher with this employee ID already exists", 409);
      }
    }
  }

  const userData: {
    name?: string;
    email?: string;
    password?: string;
  } = {};

  if (input.name !== undefined) {
    userData.name = input.name;
  }

  if (input.email !== undefined) {
    userData.email = input.email;
  }

  if (input.password) {
    userData.password = await bcrypt.hash(input.password, 10);
  }

  const detailData: {
    employeeId?: string | null | { unset: true };
    phone?: string | null;
    workStartTime?: string;
    workEndTime?: string;
    halfDayThresholdTime?: string;
    monthlySalary?: number;
  } = {};

  if (input.employeeId !== undefined) {
    detailData.employeeId =
      input.employeeId === null ? { unset: true } : input.employeeId;
  }

  if (input.phone !== undefined) {
    detailData.phone = input.phone;
  }

  if (input.workStartTime !== undefined) {
    detailData.workStartTime = input.workStartTime;
  }

  if (input.workEndTime !== undefined) {
    detailData.workEndTime = input.workEndTime;
  }

  if (input.halfDayThresholdTime !== undefined) {
    detailData.halfDayThresholdTime = input.halfDayThresholdTime;
  }

  if (input.monthlySalary !== undefined) {
    detailData.monthlySalary = input.monthlySalary;
  }

  const user = await prisma.user.update({
    where: { id: teacherDetail.userId },
    data: {
      ...userData,
      ...(Object.keys(detailData).length > 0
        ? { teacherDetail: { update: detailData } }
        : {}),
    },
    include: { teacherDetail: true },
  });

  return toTeacherDto(user);
}

export async function deleteTeacher(id: string): Promise<void> {
  const teacherDetail = await prisma.teacherDetail.findUnique({
    where: { id },
    include: { classes: { select: { id: true } } },
  });

  if (!teacherDetail) {
    throw new TeacherError("Teacher not found", 404);
  }

  if (teacherDetail.classes.length > 0) {
    throw new TeacherError(
      "Cannot delete teacher with assigned classes",
      409,
    );
  }

  await prisma.$transaction([
    prisma.teacherAttendance.deleteMany({ where: { teacherId: id } }),
    prisma.teacherDetail.delete({ where: { id } }),
    prisma.user.delete({ where: { id: teacherDetail.userId } }),
  ]);
}

export class TeacherError extends Error {
  constructor(
    message: string,
    public statusCode: number,
  ) {
    super(message);
    this.name = "TeacherError";
  }
}
