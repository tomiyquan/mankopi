import type { HolidayRollover } from "@mankopi/shared";

export type Holiday = {
  date: string;
  name: string;
  source: "NATIONAL" | "TENANT";
  enabled: boolean;
};

/** Libur nasional Indonesia 2026 — default yang bisa di-override tenant. */
export const INDONESIA_NATIONAL_HOLIDAYS_2026: Holiday[] = [
  { date: "2026-01-01", name: "Tahun Baru", source: "NATIONAL", enabled: true },
  { date: "2026-03-21", name: "Hari Suci Nyepi", source: "NATIONAL", enabled: true },
  { date: "2026-03-31", name: "Idul Fitri 1447 H", source: "NATIONAL", enabled: true },
  { date: "2026-04-01", name: "Idul Fitri 1447 H", source: "NATIONAL", enabled: true },
  { date: "2026-05-01", name: "Hari Buruh", source: "NATIONAL", enabled: true },
  { date: "2026-05-14", name: "Kenaikan Isa Almasih", source: "NATIONAL", enabled: true },
  { date: "2026-05-27", name: "Hari Raya Waisak", source: "NATIONAL", enabled: true },
  { date: "2026-06-01", name: "Hari Lahir Pancasila", source: "NATIONAL", enabled: true },
  { date: "2026-08-17", name: "Hari Kemerdekaan", source: "NATIONAL", enabled: true },
  { date: "2026-12-25", name: "Hari Natal", source: "NATIONAL", enabled: true },
];

export type TenantCalendar = {
  weekends: number[];
  holidays: Holiday[];
};

export function mergeCalendar(tenantHolidays: Holiday[] = []): TenantCalendar {
  const extra = tenantHolidays.filter((h) => h.source === "TENANT");
  const disabledNational = new Set(
    tenantHolidays.filter((h) => h.source === "NATIONAL" && !h.enabled).map((h) => h.date),
  );
  const national = INDONESIA_NATIONAL_HOLIDAYS_2026.map((h) => ({
    ...h,
    enabled: !disabledNational.has(h.date),
  }));
  return {
    weekends: [0],
    holidays: [...national, ...extra],
  };
}

export function isNonWorkingDay(isoDate: string, calendar: TenantCalendar): boolean {
  const day = new Date(`${isoDate}T00:00:00Z`).getUTCDay();
  if (calendar.weekends.includes(day)) return true;
  return calendar.holidays.some((h) => h.enabled && h.date === isoDate);
}

export function applyRollover(
  isoDate: string,
  calendar: TenantCalendar,
  policy: HolidayRollover,
): string {
  if (policy === "STAY" || !isNonWorkingDay(isoDate, calendar)) return isoDate;
  const cursor = new Date(`${isoDate}T00:00:00Z`);
  const step = policy === "FORWARD" ? 1 : -1;
  for (let i = 0; i < 14; i += 1) {
    cursor.setUTCDate(cursor.getUTCDate() + step);
    const next = cursor.toISOString().slice(0, 10);
    if (!isNonWorkingDay(next, calendar)) return next;
  }
  return isoDate;
}
