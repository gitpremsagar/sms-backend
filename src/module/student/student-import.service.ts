import bcrypt from "bcrypt";
import { Role } from "@prisma/client";
import prisma from "../../lib/prisma.js";
import {
  StudentImportParseError,
  parseStudentCsv,
  type ParsedStudentRow,
} from "./student-import.parser.js";
import { StudentError } from "./student.service.js";

const DEFAULT_IMPORT_PASSWORD = "Student@123";
const EMAIL_DOMAIN = "sagarmiddleschool.edu.in";
const ROLL_PREFIX = "SMS";

export type StudentImportRowResult = {
  row: number;
  name: string;
  status: "created" | "failed";
  studentId?: string;
  error?: string;
};

export type StudentImportSummary = {
  total: number;
  created: number;
  failed: number;
  results: StudentImportRowResult[];
};

function slugifyName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40) || "student";
}

function formatRollNumber(sequence: number): string {
  return `${ROLL_PREFIX}${String(sequence).padStart(3, "0")}`;
}

function generateEmail(name: string, rollNumber: string): string {
  return `${slugifyName(name)}-${rollNumber.toLowerCase()}@${EMAIL_DOMAIN}`;
}

async function getNextRollSequence(): Promise<number> {
  const students = await prisma.studentDetail.findMany({
    where: {
      studentRollNumber: {
        startsWith: ROLL_PREFIX,
      },
    },
    select: { studentRollNumber: true },
  });

  let maxSequence = 0;

  for (const student of students) {
    const match = student.studentRollNumber.match(/^SMS(\d+)$/i);
    if (!match) {
      continue;
    }

    const sequence = Number(match[1]);
    if (Number.isFinite(sequence) && sequence > maxSequence) {
      maxSequence = sequence;
    }
  }

  return maxSequence + 1;
}

function buildClassMap(
  classes: { id: string; className: string }[],
): Map<string, string> {
  const map = new Map<string, string>();

  for (const schoolClass of classes) {
    map.set(schoolClass.className.trim().toLowerCase(), schoolClass.id);
  }

  return map;
}

function validateClasses(
  rows: ParsedStudentRow[],
  classMap: Map<string, string>,
): string[] {
  const missing = new Set<string>();

  for (const row of rows) {
    if (!classMap.has(row.currentClass.toLowerCase())) {
      missing.add(row.currentClass);
    }
  }

  return [...missing].sort();
}

async function createImportedStudent(
  row: ParsedStudentRow,
  classId: string,
  rollNumber: string,
): Promise<string> {
  const email = generateEmail(row.name, rollNumber);
  const hashedPassword = await bcrypt.hash(DEFAULT_IMPORT_PASSWORD, 10);

  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) {
    throw new StudentError("A user with this email already exists", 409);
  }

  const existingRoll = await prisma.studentDetail.findUnique({
    where: { studentRollNumber: rollNumber },
  });
  if (existingRoll) {
    throw new StudentError("A student with this roll number already exists", 409);
  }

  const user = await prisma.user.create({
    data: {
      name: row.name,
      email,
      password: hashedPassword,
      role: Role.STUDENT,
      studentDetail: {
        create: {
          studentRollNumber: rollNumber,
          classId,
          parentIds: [],
          admissionDate: row.admissionDate,
          motherName: row.motherName,
          fatherName: row.fatherName,
          studentAadharNumber: row.studentAadharNumber,
          fatherAadharNumber: row.fatherAadharNumber,
          motherAadharNumber: row.motherAadharNumber,
          dateOfBirth: row.dateOfBirth,
          whatsappNumber: row.whatsappNumber,
          contactNumber1: row.contactNumber1,
          contactNumber2: row.contactNumber2,
          isStudying: row.isStudying,
        },
      },
    },
    include: { studentDetail: true },
  });

  if (!user.studentDetail) {
    throw new StudentError("Failed to create student profile", 500);
  }

  return user.studentDetail.id;
}

export async function importStudentsFromCsv(
  csvContent: string,
): Promise<StudentImportSummary> {
  let rows: ParsedStudentRow[];

  try {
    rows = parseStudentCsv(csvContent);
  } catch (error) {
    if (error instanceof StudentImportParseError) {
      throw new StudentError(error.message, 400);
    }
    throw error;
  }

  const classes = await prisma.class.findMany({
    select: { id: true, className: true },
  });
  const classMap = buildClassMap(classes);
  const missingClasses = validateClasses(rows, classMap);

  if (missingClasses.length > 0) {
    throw new StudentError(
      `Missing classes in the system: ${missingClasses.join(", ")}. Create them before importing.`,
      400,
    );
  }

  let rollSequence = await getNextRollSequence();
  const results: StudentImportRowResult[] = [];
  let created = 0;
  let failed = 0;

  for (const row of rows) {
    const classId = classMap.get(row.currentClass.toLowerCase());
    if (!classId) {
      results.push({
        row: row.row,
        name: row.name,
        status: "failed",
        error: `Class not found: ${row.currentClass}`,
      });
      failed += 1;
      continue;
    }

    const rollNumber = formatRollNumber(rollSequence);
    rollSequence += 1;

    try {
      const studentId = await createImportedStudent(row, classId, rollNumber);
      results.push({
        row: row.row,
        name: row.name,
        status: "created",
        studentId,
      });
      created += 1;
    } catch (error) {
      results.push({
        row: row.row,
        name: row.name,
        status: "failed",
        error:
          error instanceof StudentError
            ? error.message
            : "Failed to create student",
      });
      failed += 1;
    }
  }

  return {
    total: rows.length,
    created,
    failed,
    results,
  };
}
