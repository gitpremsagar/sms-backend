import bcrypt from "bcrypt";
import { Role } from "@prisma/client";
import prisma from "../../lib/prisma.js";
import type { CreateTeacherInput } from "./teacher.schema.js";

export type TeacherDto = {
  id: string;
  userId: string;
  name: string;
  email: string;
  employeeId: string | null;
  phone: string | null;
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
        },
      },
    },
    include: { teacherDetail: true },
  });

  return toTeacherDto(user);
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
