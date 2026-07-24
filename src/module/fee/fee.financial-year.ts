export const FY_MONTHS = [4, 5, 6, 7, 8, 9, 10, 11, 12, 1, 2, 3] as const;

const MONTH_LABELS: Record<number, string> = {
  1: "Jan",
  2: "Feb",
  3: "Mar",
  4: "Apr",
  5: "May",
  6: "Jun",
  7: "Jul",
  8: "Aug",
  9: "Sep",
  10: "Oct",
  11: "Nov",
  12: "Dec",
};

const MONTH_LABELS_HI: Record<number, string> = {
  1: "जनवरी",
  2: "फरवरी",
  3: "मार्च",
  4: "अप्रैल",
  5: "मई",
  6: "जून",
  7: "जुलाई",
  8: "अगस्त",
  9: "सितंबर",
  10: "अक्टूबर",
  11: "नवंबर",
  12: "दिसंबर",
};

export function getFinancialYearStart(date: Date = new Date()): number {
  const month = date.getMonth() + 1;
  const year = date.getFullYear();
  return month >= 4 ? year : year - 1;
}

export function formatFinancialYearLabel(start: number): string {
  const end = (start + 1) % 100;
  return `${start}-${String(end).padStart(2, "0")}`;
}

export function resolveCalendarYear(
  financialYearStart: number,
  month: number,
): number {
  return month >= 4 ? financialYearStart : financialYearStart + 1;
}

export function getMonthLabel(month: number): string {
  return MONTH_LABELS[month] ?? String(month);
}

export function getMonthLabelHi(month: number): string {
  return MONTH_LABELS_HI[month] ?? String(month);
}

export function getMonthsThrough(targetMonth: number): number[] {
  const index = FY_MONTHS.indexOf(targetMonth as (typeof FY_MONTHS)[number]);
  if (index === -1) {
    return [];
  }
  return FY_MONTHS.slice(0, index + 1) as unknown as number[];
}

export function getMonthsFrom(targetMonth: number): number[] {
  const index = FY_MONTHS.indexOf(targetMonth as (typeof FY_MONTHS)[number]);
  if (index === -1) {
    return [];
  }
  return FY_MONTHS.slice(index) as unknown as number[];
}

export function isMonthDue(
  financialYearStart: number,
  month: number,
  today: Date = new Date(),
): boolean {
  const currentFyStart = getFinancialYearStart(today);
  const currentMonth = today.getMonth() + 1;

  if (financialYearStart < currentFyStart) {
    return true;
  }

  if (financialYearStart > currentFyStart) {
    return false;
  }

  const monthIndex = FY_MONTHS.indexOf(month as (typeof FY_MONTHS)[number]);
  const currentIndex = FY_MONTHS.indexOf(
    currentMonth as (typeof FY_MONTHS)[number],
  );

  if (monthIndex === -1 || currentIndex === -1) {
    return false;
  }

  return monthIndex <= currentIndex;
}

/** True when the FY month is on/after admission, or when admission is unset. */
export function isMonthOnOrAfterAdmission(
  financialYearStart: number,
  month: number,
  admissionDate: Date | null | undefined,
): boolean {
  if (!admissionDate) {
    return true;
  }

  const cellYear = resolveCalendarYear(financialYearStart, month);
  const admissionYear = admissionDate.getFullYear();
  const admissionMonth = admissionDate.getMonth() + 1;

  if (cellYear > admissionYear) {
    return true;
  }

  if (cellYear < admissionYear) {
    return false;
  }

  return month >= admissionMonth;
}

export function isCurrentFyMonth(
  financialYearStart: number,
  month: number,
  today: Date = new Date(),
): boolean {
  return (
    financialYearStart === getFinancialYearStart(today) &&
    month === today.getMonth() + 1
  );
}

export function buildFinancialYearMonths(financialYearStart: number) {
  return FY_MONTHS.map((month) => ({
    month,
    label: getMonthLabel(month),
    labelHi: getMonthLabelHi(month),
    calendarYear: resolveCalendarYear(financialYearStart, month),
  }));
}

export function listFinancialYearOptions(
  centerYear?: number,
  range = 5,
): { start: number; label: string }[] {
  const center = centerYear ?? getFinancialYearStart();
  const half = Math.floor(range / 2);

  return Array.from({ length: range }, (_, index) => {
    const start = center - half + index;
    return { start, label: formatFinancialYearLabel(start) };
  });
}
