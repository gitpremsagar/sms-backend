import prisma from "../../lib/prisma.js";
import type { CreateClassInput } from "./class.schema.js";

export type ClassDto = {
  id: string;
  className: string;
  teacherId: string;
  teacherName: string;
  createdAt: string;
};

function toClassDto(cls: {
  id: string;
  className: string;
  teacherId: string;
  createdAt: Date;
  teacher: { user: { name: string } };
}): ClassDto {
  return {
    id: cls.id,
    className: cls.className,
    teacherId: cls.teacherId,
    teacherName: cls.teacher.user.name,
    createdAt: cls.createdAt.toISOString(),
  };
}

export async function listClasses(): Promise<ClassDto[]> {
  const classes = await prisma.class.findMany({
    include: {
      teacher: {
        include: { user: true },
      },
    },
    orderBy: { className: "asc" },
  });

  return classes.map((cls) => toClassDto(cls));
}

export async function createClass(input: CreateClassInput): Promise<ClassDto> {
  const existingClass = await prisma.class.findUnique({
    where: { className: input.className },
  });

  if (existingClass) {
    throw new ClassError("A class with this name already exists", 409);
  }

  const teacher = await prisma.teacherDetail.findUnique({
    where: { id: input.teacherId },
  });

  if (!teacher) {
    throw new ClassError("Teacher not found", 404);
  }

  const schoolClass = await prisma.class.create({
    data: {
      className: input.className,
      teacherId: input.teacherId,
    },
    include: {
      teacher: {
        include: { user: true },
      },
    },
  });

  return toClassDto(schoolClass);
}

export class ClassError extends Error {
  constructor(
    message: string,
    public statusCode: number,
  ) {
    super(message);
    this.name = "ClassError";
  }
}
