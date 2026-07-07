import { parse } from "csv-parse/sync";

export type ParsedStudentRow = {
  row: number;
  name: string;
  currentClass: string;
  admissionDate: Date | null;
  motherName: string | null;
  fatherName: string | null;
  studentAadharNumber: string | null;
  fatherAadharNumber: string | null;
  motherAadharNumber: string | null;
  dateOfBirth: Date | null;
  whatsappNumber: string | null;
  contactNumber1: string | null;
  contactNumber2: string | null;
  isStudying: boolean;
};

export class StudentImportParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StudentImportParseError";
  }
}

function trimOrNull(value: unknown): string | null {
  if (value === undefined || value === null) {
    return null;
  }

  const trimmed = String(value).trim();
  return trimmed.length > 0 ? trimmed : null;
}

function parseDate(value: unknown): Date | null {
  const text = trimOrNull(value);
  if (!text) {
    return null;
  }

  const ddMmYyyy = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/;
  const yyyyMmDd = /^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/;

  let year: number;
  let month: number;
  let day: number;

  const ddMatch = text.match(ddMmYyyy);
  if (ddMatch) {
    day = Number(ddMatch[1]);
    month = Number(ddMatch[2]);
    year = Number(ddMatch[3]);
  } else {
    const isoMatch = text.match(yyyyMmDd);
    if (!isoMatch) {
      return null;
    }
    year = Number(isoMatch[1]);
    month = Number(isoMatch[2]);
    day = Number(isoMatch[3]);
  }

  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return date;
}

function parseIsStudying(value: unknown): boolean {
  const text = trimOrNull(value);
  if (!text) {
    return true;
  }

  const normalized = text.toUpperCase();
  if (normalized === "TRUE" || normalized === "YES" || normalized === "1") {
    return true;
  }

  if (normalized === "FALSE" || normalized === "NO" || normalized === "0") {
    return false;
  }

  return true;
}

export function parseStudentCsv(csvContent: string): ParsedStudentRow[] {
  let records: Record<string, unknown>[];

  try {
    records = parse(csvContent, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      bom: true,
    }) as Record<string, unknown>[];
  } catch {
    throw new StudentImportParseError("Invalid CSV format");
  }

  if (records.length === 0) {
    throw new StudentImportParseError("CSV file contains no student rows");
  }

  const rows: ParsedStudentRow[] = [];

  for (let index = 0; index < records.length; index += 1) {
    const record = records[index];
    if (!record) {
      continue;
    }

    const rowNumber = index + 2;
    const name = trimOrNull(record["Student Name"]);
    const currentClass = trimOrNull(record["Current Class"]);

    if (!name) {
      throw new StudentImportParseError(
        `Row ${rowNumber}: Student Name is required`,
      );
    }

    if (!currentClass) {
      throw new StudentImportParseError(
        `Row ${rowNumber}: Current Class is required`,
      );
    }

    rows.push({
      row: rowNumber,
      name,
      currentClass,
      admissionDate: parseDate(record["Admission Date"]),
      motherName: trimOrNull(record["Mother's Name"]),
      fatherName: trimOrNull(record["Father's Name"]),
      studentAadharNumber: trimOrNull(record["Student Aadhar Number"]),
      fatherAadharNumber: trimOrNull(record["Father Aadhar Number"]),
      motherAadharNumber: trimOrNull(record["Mother Aadhar Number"]),
      dateOfBirth: parseDate(record["Date of Birth"]),
      whatsappNumber: trimOrNull(record["Whatsapp Number"]),
      contactNumber1: trimOrNull(record["Contact Number 1"]),
      contactNumber2: trimOrNull(record["Contact Number 2"]),
      isStudying: parseIsStudying(record.isStudying),
    });
  }

  return rows;
}
