import bcrypt from "bcrypt";
import { Role } from "@prisma/client";
import prisma from "../../lib/prisma.js";
import type { CreateStudentInput } from "./student.schema.js";

export type StudentDto = {
  id: string;
  userId: string;
  name: string;
  email: string;
  studentRollNumber: string;
  classId: string;
  className: string;
  createdAt: string;
};

function toStudentDto(user: {
  id: string;
  name: string;
  email: string;
  createdAt: Date;
  studentDetail: {
    id: string;
    studentRollNumber: string;
    classId: string;
    class: { className: string };
  } | null;
}): StudentDto {
  if (!user.studentDetail) {
    throw new StudentError("Student profile not found", 500);
  }

  return {
    id: user.studentDetail.id,
    userId: user.id,
    name: user.name,
    email: user.email,
    studentRollNumber: user.studentDetail.studentRollNumber,
    classId: user.studentDetail.classId,
    className: user.studentDetail.class.className,
    createdAt: user.createdAt.toISOString(),
  };
}

export async function listStudents(): Promise<StudentDto[]> {
  const users = await prisma.user.findMany({
    where: { role: Role.STUDENT },
    include: {
      studentDetail: {
        include: { class: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return users
    .filter((user) => user.studentDetail)
    .map((user) => toStudentDto(user));
}

export async function createStudent(input: CreateStudentInput): Promise<StudentDto> {
  const existingUser = await prisma.user.findUnique({
    where: { email: input.email },
  });

  if (existingUser) {
    throw new StudentError("A user with this email already exists", 409);
  }

  const existingRoll = await prisma.studentDetail.findUnique({
    where: { studentRollNumber: input.studentRollNumber },
  });

  if (existingRoll) {
    throw new StudentError("A student with this roll number already exists", 409);
  }

  const schoolClass = await prisma.class.findUnique({
    where: { id: input.classId },
  });

  if (!schoolClass) {
    throw new StudentError("Class not found", 404);
  }

  const hashedPassword = await bcrypt.hash(input.password, 10);

  const user = await prisma.user.create({
    data: {
      name: input.name,
      email: input.email,
      password: hashedPassword,
      role: Role.STUDENT,
      studentDetail: {
        create: {
          studentRollNumber: input.studentRollNumber,
          classId: input.classId,
          parentIds: [],
        },
      },
    },
    include: {
      studentDetail: {
        include: { class: true },
      },
    },
  });

  return toStudentDto(user);
}

export class StudentError extends Error {
  constructor(
    message: string,
    public statusCode: number,
  ) {
    super(message);
    this.name = "StudentError";
  }
}
