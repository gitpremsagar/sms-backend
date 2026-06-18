import prisma from "../../lib/prisma.js";
import type { CreateClassInput, UpdateClassInput } from "./class.schema.js";

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

export async function getClassById(id: string): Promise<ClassDto> {
  const schoolClass = await prisma.class.findUnique({
    where: { id },
    include: {
      teacher: {
        include: { user: true },
      },
    },
  });

  if (!schoolClass) {
    throw new ClassError("Class not found", 404);
  }

  return toClassDto(schoolClass);
}

export async function updateClass(
  id: string,
  input: UpdateClassInput,
): Promise<ClassDto> {
  const existingClass = await prisma.class.findUnique({
    where: { id },
  });

  if (!existingClass) {
    throw new ClassError("Class not found", 404);
  }

  if (input.className && input.className !== existingClass.className) {
    const duplicateClass = await prisma.class.findUnique({
      where: { className: input.className },
    });

    if (duplicateClass) {
      throw new ClassError("A class with this name already exists", 409);
    }
  }

  if (input.teacherId) {
    const teacher = await prisma.teacherDetail.findUnique({
      where: { id: input.teacherId },
    });

    if (!teacher) {
      throw new ClassError("Teacher not found", 404);
    }
  }

  const data: {
    className?: string;
    teacherId?: string;
  } = {};

  if (input.className !== undefined) {
    data.className = input.className;
  }

  if (input.teacherId !== undefined) {
    data.teacherId = input.teacherId;
  }

  const schoolClass = await prisma.class.update({
    where: { id },
    data,
    include: {
      teacher: {
        include: { user: true },
      },
    },
  });

  return toClassDto(schoolClass);
}

export async function deleteClass(id: string): Promise<void> {
  const schoolClass = await prisma.class.findUnique({
    where: { id },
    include: { students: { select: { id: true } } },
  });

  if (!schoolClass) {
    throw new ClassError("Class not found", 404);
  }

  if (schoolClass.students.length > 0) {
    throw new ClassError(
      "Cannot delete class with enrolled students",
      409,
    );
  }

  await prisma.class.delete({ where: { id } });
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
