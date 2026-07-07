import { z } from "zod";

const optionalString = z.string().optional().nullable();
const optionalDate = z
  .union([z.string().datetime(), z.string().date(), z.null()])
  .optional()
  .nullable();

const studentProfileFields = {
  admissionDate: optionalDate,
  motherName: optionalString,
  fatherName: optionalString,
  studentAadharNumber: optionalString,
  fatherAadharNumber: optionalString,
  motherAadharNumber: optionalString,
  dateOfBirth: optionalDate,
  whatsappNumber: optionalString,
  contactNumber1: optionalString,
  contactNumber2: optionalString,
  isStudying: z.boolean().optional(),
};

export const createStudentSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(6),
  studentRollNumber: z.string().min(1),
  classId: z.string().min(1),
  ...studentProfileFields,
});

export const updateStudentSchema = z
  .object({
    name: z.string().min(1).optional(),
    email: z.string().email().optional(),
    password: z.string().min(6).optional(),
    studentRollNumber: z.string().min(1).optional(),
    classId: z.string().min(1).optional(),
    ...studentProfileFields,
  })
  .refine((data) => Object.values(data).some((value) => value !== undefined), {
    message: "At least one field must be provided",
  });

export const importStudentsSchema = z.object({
  csvContent: z.string().min(1),
});

export type CreateStudentInput = z.infer<typeof createStudentSchema>;
export type UpdateStudentInput = z.infer<typeof updateStudentSchema>;
export type ImportStudentsInput = z.infer<typeof importStudentsSchema>;
