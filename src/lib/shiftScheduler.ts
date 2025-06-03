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
  private shiftMap: Record<string, ShiftType>;

  constructor(options: ScheduleOptions) {
    this.options = options;
    this.assignments = [...(options.existingAssignments || [])];
    this.conflicts = [];
    this.employeeWorkloads = {};
    this.shiftMap = {};
    for (const st of options.shiftTypes) {
      this.shiftMap[st.id] = st;
    }
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

  private dateDiffInDays(a: Date, b: Date): number {
    const d1 = new Date(a.toDateString());
    const d2 = new Date(b.toDateString());
    return Math.floor((d2.getTime() - d1.getTime()) / (24 * 60 * 60 * 1000));
  }

  private violatesForbiddenSequence(employee: Employee, date: Date, shiftType: ShiftType): boolean {
    for (const rule of this.options.shiftRules) {
      if (rule.type !== "forbidden_sequence") continue;
      const toIds = rule.toShiftIds || [];

      for (const a of this.assignments) {
        if (a.employeeId !== employee.id) continue;
        const assignedDate = new Date(a.date);
        const diff = this.dateDiffInDays(assignedDate, date);

        if (a.shiftId === rule.fromShiftId && toIds.includes(shiftType.id)) {
          if ((rule.sameDay && diff === 0) || (!rule.sameDay && diff === 1)) {
            return true;
          }
        }

        if (shiftType.id === rule.fromShiftId && toIds.includes(a.shiftId)) {
          if ((rule.sameDay && diff === 0) || (!rule.sameDay && diff === -1)) {
            return true;
          }
        }
      }
    }
    return false;
  }

  private applyMandatoryFollowUps(employee: Employee, date: Date, shiftType: ShiftType): void {
    for (const rule of this.options.shiftRules) {
      if (rule.type !== "mandatory_follow_up" || rule.fromShiftId !== shiftType.id) continue;
      const toShift = this.shiftMap[rule.toShiftId ?? ""];
      if (!toShift) continue;

      const fromName = this.shiftMap[rule.fromShiftId]?.name;
      const toName = toShift.name;
      const isFirstYear = employee.lehrjahr === 1;
      if (isFirstYear && rule.sameDay &&
          ((fromName === "2A. VM" && toName === "2B. NM") ||
           (fromName === "2B. VM" && toName === "2A. NM"))) {
        continue;
      }

      const followDate = new Date(date);
      if (!rule.sameDay) followDate.setDate(followDate.getDate() + 1);
      const followDateStr = followDate.toISOString().split("T")[0];

      if (!employee.allowedShifts.includes(toShift.id)) {
        this.conflicts.push(`Folgeschicht ${toShift.name} für ${employee.firstName} ${employee.lastName} am ${followDateStr} nicht erlaubt`);
        continue;
      }
      if (!this.isEmployeeAvailable(employee, followDate, toShift)) {
        this.conflicts.push(`Mitarbeiter ${employee.firstName} ${employee.lastName} nicht verfügbar für Folgeschicht ${toShift.name} am ${followDateStr}`);
        continue;
      }

      const alreadyPrimary = this.assignments.some(a => a.employeeId === employee.id && a.date === followDateStr && !a.isFollowUp);
      const alreadyThisShift = this.assignments.some(a => a.employeeId === employee.id && a.date === followDateStr && a.shiftId === toShift.id);
      if (alreadyPrimary || alreadyThisShift) {
        continue;
      }

      const assignment: ShiftAssignment = {
        employeeId: employee.id,
        shiftId: toShift.id,
        date: followDateStr,
        locked: false,
        isFollowUp: true,
      };
      this.assignments.push(assignment);
      const duration = this.calculateShiftDuration(toShift);
      this.employeeWorkloads[employee.id].hours += duration;
      this.employeeWorkloads[employee.id].shifts += 1;
      this.employeeWorkloads[employee.id].daysWorkedThisPeriod[followDateStr] = true;
    }
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

            const alreadyAssigned = this.assignments.some(a => a.employeeId === employee.id && a.date === dateStr && !a.isFollowUp);
            if (alreadyAssigned) continue;

            if (this.violatesForbiddenSequence(employee, currentDate, shiftType)) continue;

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
            this.applyMandatoryFollowUps(employee, currentDate, shiftType);
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
