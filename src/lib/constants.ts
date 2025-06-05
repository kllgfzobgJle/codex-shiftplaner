import type { ShiftType } from './types';
import { WEEKDAYS } from './types';

export const FULL_TIME_WEEKLY_HOURS = 42.5;

/**
 * Calculate the duration of a single shift in hours.
 */
export function calculateShiftDuration(shift: ShiftType): number {
  const [startH, startM] = shift.startTime.split(':').map(Number);
  const [endH, endM] = shift.endTime.split(':').map(Number);

  const startMinutes = startH * 60 + startM;
  let endMinutes = endH * 60 + endM;
  if (endMinutes < startMinutes) {
    endMinutes += 24 * 60; // overnight shift
  }
  return (endMinutes - startMinutes) / 60;
}

/**
 * Sum up the required hours for all shift types for a single week.
 */
export function calculateWeeklyShiftHours(shiftTypes: ShiftType[]): number {
  let hours = 0;
  for (const st of shiftTypes) {
    const duration = calculateShiftDuration(st);
    for (const day of WEEKDAYS) {
      hours += (st.weeklyNeeds[day] ?? 0) * duration;
    }
  }
  return hours;
}

/**
 * Get the required hours for a standard four week planning period.
 */
export function calculateFourWeekShiftHours(shiftTypes: ShiftType[]): number {
  return calculateWeeklyShiftHours(shiftTypes) * 4;
}
