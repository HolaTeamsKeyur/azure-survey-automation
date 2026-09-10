export interface BusinessHours {
  startHour: number;
  endHour: number;
  workingDays: number[];
}

export interface BusyPeriod {
  start: Date;
  end: Date;
}

export function findFirstAvailableSlot(
  searchFrom: Date,
  durationMinutes: number,
  businessHours: BusinessHours,
  busyPeriods: readonly BusyPeriod[],
  timeZone: string,
  horizonDays = 21
): { start: Date; end: Date } {
  if (durationMinutes <= 0 || durationMinutes > 8 * 60) throw new Error("Invalid survey duration.");
  let cursor: DateTime<boolean> = DateTime.fromJSDate(searchFrom, { zone: timeZone }).set({ second: 0, millisecond: 0 });
  cursor = cursor.plus({ minutes: Math.ceil(cursor.minute / 15) * 15 - cursor.minute });
  const limit = cursor.plus({ days: horizonDays });

  while (cursor < limit) {
    const weekday = cursor.weekday % 7;
    if (!businessHours.workingDays.includes(weekday)) {
      cursor = moveToNextDay(cursor, businessHours.startHour);
      continue;
    }
    if (cursor.hour < businessHours.startHour) cursor = cursor.set({ hour: businessHours.startHour, minute: 0 });
    const end = cursor.plus({ minutes: durationMinutes });
    if (end.hour > businessHours.endHour || (end.hour === businessHours.endHour && end.minute > 0)) {
      cursor = moveToNextDay(cursor, businessHours.startHour);
      continue;
    }
    const collision = busyPeriods.find(period => cursor.toMillis() < period.end.getTime() && end.toMillis() > period.start.getTime());
    if (!collision) return { start: cursor.toUTC().toJSDate(), end: end.toUTC().toJSDate() };
    cursor = DateTime.fromJSDate(collision.end, { zone: timeZone }).set({ second: 0, millisecond: 0 });
  }
  throw new Error(`No survey slot is available within ${horizonDays} days.`);
}

function moveToNextDay(date: DateTime<boolean>, startHour: number): DateTime<boolean> {
  return date.plus({ days: 1 }).startOf("day").set({ hour: startHour });
}
import { DateTime } from "luxon";
