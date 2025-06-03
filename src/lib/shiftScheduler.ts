import type {
  Employee,
  Team,
  ShiftType,
  LearningYearQualification,
  ShiftRule,
  ShiftAssignment,
  WorkloadStats,
  WeekDay,
  WEEKDAYS
} from './types';

export interface ScheduleOptions {
  startDate: Date;
  endDate: Date;
  employees: Employee[];
  teams: Team[];
  shiftTypes: ShiftType[];
  learningYearQualifications: LearningYearQualification[];
  shiftRules: ShiftRule[];
  existingAssignments?: ShiftAssignment[];
}

export interface ScheduleResult {
  assignments: ShiftAssignment[];
  conflicts: string[];
  statistics: {
    totalAssignments: number;
    unassignedShifts: number;
    employeeWorkloads: Record<string, WorkloadStats>;
  };
}

const WEEKDAY_MAPPING = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

export class ShiftScheduler {
  private options: ScheduleOptions;
  private assignments: ShiftAssignment[];
  private conflicts: string[];
  private employeeWorkloads: Record<string, WorkloadStats>;

  constructor(options: ScheduleOptions) {
    this.options = options;
    this.assignments = [...(options.existingAssignments || [])];
    this.conflicts = [];
    this.employeeWorkloads = {};
    this.initializeWorkloads();
    console.log('[ShiftScheduler] Initialized with', options.employees.length, 'employees and', options.shiftTypes.length, 'shift types.');
  }

  private initializeWorkloads(): void {
    for (const employee of this.options.employees) {
      const team = this.options.teams.find(t => t.id === employee.teamId);
      const effectivePercentage = employee.specificShiftPercentage ?? (team ? team.overallShiftPercentage : 100);

      this.employeeWorkloads[employee.id] = {
        hours: 0,
        shifts: 0,
        targetPercentage: effectivePercentage,
        daysWorkedThisPeriod: {},
      };
    }

    for (const assignment of this.assignments) {
      if (this.employeeWorkloads[assignment.employeeId]) {
        const shiftType = this.options.shiftTypes.find(st => st.id === assignment.shiftId);
        if (shiftType) {
          const duration = this.calculateShiftDuration(shiftType);
          this.employeeWorkloads[assignment.employeeId].hours += Number.isFinite(duration) ? duration : 0;
          this.employeeWorkloads[assignment.employeeId].shifts += 1;
          this.employeeWorkloads[assignment.employeeId].daysWorkedThisPeriod[assignment.date] = true;
        }
      }
    }
    console.log('[ShiftScheduler] Workloads initialized:', this.employeeWorkloads);
  }

  private calculateShiftDuration(shiftType: ShiftType): number {
    const [startH, startM] = shiftType.startTime.split(':').map(Number);
    const [endH, endM] = shiftType.endTime.split(':').map(Number);

    const startMinutes = startH * 60 + startM;
    let endMinutes = endH * 60 + endM;

    if (endMinutes < startMinutes) {
      endMinutes += 24 * 60;
    }

    return (endMinutes - startMinutes) / 60;
  }

  private getWeekdayName(date: Date): WeekDay | null {
    const dayIndex = date.getDay();
    const dayName = WEEKDAY_MAPPING[dayIndex] as WeekDay;
    return ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'].includes(dayName) ? dayName : null;
  }

  private isEmployeeAvailable(employee: Employee, date: Date, shiftType: ShiftType): boolean {
    const weekday = this.getWeekdayName(date);
    if (!weekday) return false;

    const shiftStartHour = Number.parseInt(shiftType.startTime.split(':')[0]);
    const shiftEndHour = Number.parseInt(shiftType.endTime.split(':')[0]);

    if (shiftStartHour < 12) {
      const morningKey = `${weekday}_AM`;
      if (employee.availability[morningKey] !== true) return false;
    }

    if (shiftEndHour >= 12 || (shiftStartHour >= 12 && shiftStartHour < 24)) {
      const afternoonKey = `${weekday}_PM`;
      if (employee.availability[afternoonKey] !== true) return false;
    }

    if (shiftType.endTime < shiftType.startTime) {
      const nextDay = new Date(date);
      nextDay.setDate(date.getDate() + 1);
      const nextWeekday = this.getWeekdayName(nextDay);

      if (nextWeekday && shiftEndHour > 0 && shiftEndHour < 12) {
        const nextMorningKey = `${nextWeekday}_AM`;
        if (employee.availability[nextMorningKey] !== true) return false;
      }
    }

    return true;
  }

  public schedule(): ScheduleResult {
    const currentDate = new Date(this.options.startDate);
    const endDate = new Date(this.options.endDate);
    while (currentDate <= endDate) {
      const weekday = this.getWeekdayName(currentDate);
      if (weekday) {
        const dateStr = currentDate.toISOString().split('T')[0];
        for (const shiftType of this.options.shiftTypes) {
          let assigned = false;
          const sorted = this.options.employees.slice().sort((a, b) => {
            return this.employeeWorkloads[a.id].hours - this.employeeWorkloads[b.id].hours;
          });
          for (const employee of sorted) {
            if (!employee.allowedShifts.includes(shiftType.id)) continue;
            if (!this.isEmployeeAvailable(employee, currentDate, shiftType)) continue;

            const alreadyAssigned = this.assignments.some(a => a.employeeId === employee.id && a.date === dateStr);
            if (alreadyAssigned) continue;

            const assignment: ShiftAssignment = {
              employeeId: employee.id,
              shiftId: shiftType.id,
              date: dateStr,
              locked: false,
              isFollowUp: false,
            };
            this.assignments.push(assignment);
            const duration = this.calculateShiftDuration(shiftType);
            this.employeeWorkloads[employee.id].hours += duration;
            this.employeeWorkloads[employee.id].shifts += 1;
            this.employeeWorkloads[employee.id].daysWorkedThisPeriod[dateStr] = true;
            assigned = true;
            break;
          }
          if (!assigned) {
            this.conflicts.push(`Keine verfügbare Person für Schicht ${shiftType.name} am ${dateStr}`);
          }
        }
      }
      currentDate.setDate(currentDate.getDate() + 1);
    }

    return {
      assignments: this.assignments,
      conflicts: this.conflicts,
      statistics: {
        totalAssignments: this.assignments.length,
        unassignedShifts: this.conflicts.length,
        employeeWorkloads: this.employeeWorkloads,
      }
    };
  }
}

export function generateShiftSchedule(options: ScheduleOptions): ScheduleResult {
  const scheduler = new ShiftScheduler(options);
  return scheduler.schedule();
}
