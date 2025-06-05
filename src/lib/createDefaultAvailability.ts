import { WEEKDAYS, HALF_DAYS } from './types';

export function createDefaultAvailability(): Record<string, boolean> {
    return WEEKDAYS.reduce((acc, day) => {
        for (const half of HALF_DAYS) {
            acc[`${day}_${half}`] = false;
        }
        return acc;
    }, {} as Record<string, boolean>);
}
