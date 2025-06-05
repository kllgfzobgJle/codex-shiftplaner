import type {
  Employee,
  Team,
  ShiftType,
  LearningYearQualification,
  ShiftRule,
  ShiftAssignment,
  WorkloadStats,
  Absence,
  WeekDay,
  WEEKDAYS,
} from "./types";

export interface ScheduleOptions {
  startDate: Date;
  endDate: Date;
  employees: Employee[];
  teams: Team[];
  shiftTypes: ShiftType[];
  learningYearQualifications: LearningYearQualification[];
  shiftRules: ShiftRule[];
  existingAssignments?: ShiftAssignment[];
  absences?: Absence[];
}

export interface ScheduleResult {
  assignments: ShiftAssignment[];
  conflicts: string[];
  statistics: {
    totalAssignments: number;
    unassignedShifts: number;
    employeeWorkloads: Record<string, WorkloadStats>;
    teamWorkloads: Record<string, number>;
  };
}

const WEEKDAY_MAPPING = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
];

export class ShiftScheduler {
  private options: ScheduleOptions;
  private assignments: ShiftAssignment[];
  private conflicts: string[];
  private employeeWorkloads: Record<string, WorkloadStats>;
  private teamWorkloads: Record<string, number>;
  private teamTargets: Record<string, number>;
  private shiftMap: Record<string, ShiftType>;
  private zeroShiftId?: string;
  private firstVmShiftId?: string;
  private vmAssignmentsByDate: Record<string, string[]> = {};
  private apprenticesByYear: Record<number, Employee[]> = {};
  private apprenticeIndices: Record<number, number> = {};
  private activeApprenticeByYear: Record<number, string> = {};
  private apprenticeShiftCounts: Record<
    number,
    Record<string, Record<string, number>>
  > = {};

  constructor(options: ScheduleOptions) {
    this.options = options;
    this.assignments = [...(options.existingAssignments || [])];
    this.conflicts = [];
    this.employeeWorkloads = {};
    this.teamWorkloads = {};
    this.teamTargets = {};
    this.shiftMap = {};
    for (const st of options.shiftTypes) {
      this.shiftMap[st.id] = st;
    }
    this.zeroShiftId = options.shiftTypes.find((s) => s.name === "0.")?.id;
    this.firstVmShiftId = options.shiftTypes.find(
      (s) => s.name === "1. VM",
    )?.id;
    this.initializeApprentices();
    this.initializeTeamTargets();
    this.initializeWorkloads();
    console.log(
      "[ShiftScheduler] Initialized with",
      options.employees.length,
      "employees and",
      options.shiftTypes.length,
      "shift types.",
    );
  }

  private initializeApprentices(): void {
    for (const emp of this.options.employees) {
      if (emp.employeeType === "azubi" && typeof emp.lehrjahr === "number") {
        if (!this.apprenticesByYear[emp.lehrjahr]) {
          this.apprenticesByYear[emp.lehrjahr] = [];
          this.apprenticeIndices[emp.lehrjahr] = 0;
          this.apprenticeShiftCounts[emp.lehrjahr] = {};
        }
        this.apprenticesByYear[emp.lehrjahr].push(emp);
      }
    }
    for (const year of Object.keys(this.apprenticesByYear)) {
      this.apprenticesByYear[Number(year)].sort((a, b) =>
        a.id.localeCompare(b.id),
      );
      const list = this.apprenticesByYear[Number(year)];
      if (list.length > 0) {
        this.activeApprenticeByYear[Number(year)] = list[0].id;
      }
      for (const st of this.options.shiftTypes) {
        if (!this.apprenticeShiftCounts[Number(year)][st.id]) {
          this.apprenticeShiftCounts[Number(year)][st.id] = {};
        }
        for (const emp of list) {
          this.apprenticeShiftCounts[Number(year)][st.id][emp.id] = 0;
        }
      }
    }
  }

  private initializeTeamTargets(): void {
    let totalSlots = 0;
    const current = new Date(this.options.startDate);
    const end = new Date(this.options.endDate);
    while (current <= end) {
      const weekday = this.getWeekdayName(current);
      if (weekday) {
        for (const st of this.options.shiftTypes) {
          totalSlots += st.weeklyNeeds[weekday] ?? 0;
        }
      }
      current.setDate(current.getDate() + 1);
    }

    for (const team of this.options.teams) {
      this.teamTargets[team.id] = Math.round(
        (team.overallShiftPercentage / 100) * totalSlots,
      );
      this.teamWorkloads[team.id] = 0;
    }
  }

  private initializeWorkloads(): void {
    for (const employee of this.options.employees) {
      const team = this.options.teams.find((t) => t.id === employee.teamId);
      const effectivePercentage =
        employee.specificShiftPercentage ??
        (team ? team.overallShiftPercentage : 100);

      this.employeeWorkloads[employee.id] = {
        hours: 0,
        shifts: 0,
        targetPercentage: effectivePercentage,
        daysWorkedThisPeriod: {},
      };
    }

    for (const assignment of this.assignments) {
      if (this.employeeWorkloads[assignment.employeeId]) {
        const shiftType = this.options.shiftTypes.find(
          (st) => st.id === assignment.shiftId,
        );
        if (shiftType) {
          const duration = this.calculateShiftDuration(shiftType);
          this.employeeWorkloads[assignment.employeeId].hours +=
            Number.isFinite(duration) ? duration : 0;
          this.employeeWorkloads[assignment.employeeId].shifts += 1;
          this.employeeWorkloads[assignment.employeeId].daysWorkedThisPeriod[
            assignment.date
          ] = true;
          const emp = this.options.employees.find(
            (e) => e.id === assignment.employeeId,
          );
          if (emp) {
            this.teamWorkloads[emp.teamId] =
              (this.teamWorkloads[emp.teamId] || 0) + 1;
            if (
              emp.employeeType === "azubi" &&
              typeof emp.lehrjahr === "number" &&
              this.apprenticeShiftCounts[emp.lehrjahr]?.[assignment.shiftId]
            ) {
              this.apprenticeShiftCounts[emp.lehrjahr][assignment.shiftId][
                emp.id
              ] =
                (this.apprenticeShiftCounts[emp.lehrjahr][assignment.shiftId][
                  emp.id
                ] || 0) + 1;
            }
          }
        }
      }
    }
    console.log(
      "[ShiftScheduler] Workloads initialized:",
      this.employeeWorkloads,
    );
  }

  private calculateShiftDuration(shiftType: ShiftType): number {
    const [startH, startM] = shiftType.startTime.split(":").map(Number);
    const [endH, endM] = shiftType.endTime.split(":").map(Number);

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
    return ["monday", "tuesday", "wednesday", "thursday", "friday"].includes(
      dayName,
    )
      ? dayName
      : null;
  }

  private getWeekKey(date: Date): string {
    const d = new Date(date);
    const day = d.getDay();
    const diff = (day + 6) % 7; // distance from Monday
    d.setDate(d.getDate() - diff);
    return d.toISOString().split("T")[0];
  }

  private isApprenticeAllowed(employee: Employee): boolean {
    // Apprentices should not be restricted by a rotating active index.
    // All apprentices are eligible; fairness is handled separately.
    return true;
  }

  private isEmployeeAvailable(
    employee: Employee,
    date: Date,
    shiftType: ShiftType,
  ): boolean {
    const absence = this.options.absences?.find(
      (a) =>
        a.employeeId === employee.id &&
        date >= new Date(a.startDate) &&
        date <= new Date(a.endDate),
    );
    if (absence) return false;
    const weekday = this.getWeekdayName(date);
    if (!weekday) return false;

    const shiftStartHour = Number.parseInt(shiftType.startTime.split(":")[0]);
    const shiftEndHour = Number.parseInt(shiftType.endTime.split(":")[0]);

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

  private violatesForbiddenSequence(
    employee: Employee,
    date: Date,
    shiftType: ShiftType,
  ): boolean {
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

  private canApplyMandatoryFollowUps(
    employee: Employee,
    date: Date,
    shiftType: ShiftType,
  ): boolean {
    for (const rule of this.options.shiftRules) {
      if (
        rule.type !== "mandatory_follow_up" ||
        rule.fromShiftId !== shiftType.id
      )
        continue;
      const toShift = this.shiftMap[rule.toShiftId ?? ""];
      if (!toShift) continue;

      const fromName = this.shiftMap[rule.fromShiftId]?.name;
      const toName = toShift.name;
      const isFirstYear = employee.lehrjahr === 1;
      if (
        isFirstYear &&
        rule.sameDay &&
        ((fromName === "2A. VM" && toName === "2B. NM") ||
          (fromName === "2B. VM" && toName === "2A. NM"))
      ) {
        continue;
      }

      const followDate = new Date(date);
      if (!rule.sameDay) followDate.setDate(followDate.getDate() + 1);
      const followDateStr = followDate.toISOString().split("T")[0];

      if (!employee.allowedShifts.includes(toShift.id)) {
        this.conflicts.push(
          `Folgeschicht ${toShift.name} für ${employee.firstName} ${employee.lastName} am ${followDateStr} nicht erlaubt`,
        );
        return false;
      }
      if (!this.isEmployeeAvailable(employee, followDate, toShift)) {
        this.conflicts.push(
          `Mitarbeiter ${employee.firstName} ${employee.lastName} nicht verfügbar für Folgeschicht ${toShift.name} am ${followDateStr}`,
        );
        return false;
      }

      const alreadyPrimary = this.assignments.some(
        (a) =>
          a.employeeId === employee.id &&
          a.date === followDateStr &&
          !a.isFollowUp,
      );
      const alreadyThisShift = this.assignments.some(
        (a) =>
          a.employeeId === employee.id &&
          a.date === followDateStr &&
          a.shiftId === toShift.id,
      );
      if (alreadyPrimary || alreadyThisShift) {
        return false;
      }

      const weekday = this.getWeekdayName(followDate);
      const demand = weekday ? toShift.weeklyNeeds[weekday] ?? 0 : 0;
      const currentCount = this.assignments.filter(
        (a) => a.date === followDateStr && a.shiftId === toShift.id,
      ).length;
      if (currentCount >= demand) {
        return false;
      }
    }
    return true;
  }

  private applyMandatoryFollowUps(
    employee: Employee,
    date: Date,
    shiftType: ShiftType,
  ): void {
    for (const rule of this.options.shiftRules) {
      if (
        rule.type !== "mandatory_follow_up" ||
        rule.fromShiftId !== shiftType.id
      )
        continue;
      const toShift = this.shiftMap[rule.toShiftId ?? ""];
      if (!toShift) continue;

      const fromName = this.shiftMap[rule.fromShiftId]?.name;
      const toName = toShift.name;
      const isFirstYear = employee.lehrjahr === 1;
      if (
        isFirstYear &&
        rule.sameDay &&
        ((fromName === "2A. VM" && toName === "2B. NM") ||
          (fromName === "2B. VM" && toName === "2A. NM"))
      ) {
        continue;
      }

      const followDate = new Date(date);
      if (!rule.sameDay) followDate.setDate(followDate.getDate() + 1);
      const followDateStr = followDate.toISOString().split("T")[0];

      if (!employee.allowedShifts.includes(toShift.id)) {
        this.conflicts.push(
          `Folgeschicht ${toShift.name} für ${employee.firstName} ${employee.lastName} am ${followDateStr} nicht erlaubt`,
        );
        continue;
      }
      if (!this.isEmployeeAvailable(employee, followDate, toShift)) {
        this.conflicts.push(
          `Mitarbeiter ${employee.firstName} ${employee.lastName} nicht verfügbar für Folgeschicht ${toShift.name} am ${followDateStr}`,
        );
        continue;
      }

      const alreadyPrimary = this.assignments.some(
        (a) =>
          a.employeeId === employee.id &&
          a.date === followDateStr &&
          !a.isFollowUp,
      );
      const alreadyThisShift = this.assignments.some(
        (a) =>
          a.employeeId === employee.id &&
          a.date === followDateStr &&
          a.shiftId === toShift.id,
      );
      if (alreadyPrimary || alreadyThisShift) {
        continue;
      }

      const weekday = this.getWeekdayName(followDate);
      const demand = weekday ? toShift.weeklyNeeds[weekday] ?? 0 : 0;
      const currentCount = this.assignments.filter(
        (a) => a.date === followDateStr && a.shiftId === toShift.id,
      ).length;
      if (currentCount >= demand) {
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
      this.teamWorkloads[employee.teamId] =
        (this.teamWorkloads[employee.teamId] || 0) + 1;
      const duration = this.calculateShiftDuration(toShift);
      this.employeeWorkloads[employee.id].hours += duration;
      this.employeeWorkloads[employee.id].shifts += 1;
      this.employeeWorkloads[employee.id].daysWorkedThisPeriod[followDateStr] =
        true;
      if (
        employee.employeeType === "azubi" &&
        typeof employee.lehrjahr === "number" &&
        this.apprenticeShiftCounts[employee.lehrjahr]?.[toShift.id]
      ) {
        this.apprenticeShiftCounts[employee.lehrjahr][toShift.id][employee.id] =
          (this.apprenticeShiftCounts[employee.lehrjahr][toShift.id][
            employee.id
          ] || 0) + 1;
      }
    }
  }

  private rotateApprentices(): void {
    for (const year of Object.keys(this.apprenticesByYear)) {
      const y = Number(year);
      const list = this.apprenticesByYear[y];
      if (list.length > 1) {
        this.apprenticeIndices[y] =
          (this.apprenticeIndices[y] + 1) % list.length;
      }
    }
  }

  private canAssign(
    employee: Employee,
    date: Date,
    shiftType: ShiftType,
    dateStr: string,
  ): boolean {
    if (!employee.allowedShifts.includes(shiftType.id)) return false;
    if (!this.isEmployeeAvailable(employee, date, shiftType)) return false;
    if (
      this.assignments.some(
        (a) =>
          a.employeeId === employee.id && a.date === dateStr && !a.isFollowUp,
      )
    )
      return false;
    if (this.violatesForbiddenSequence(employee, date, shiftType)) return false;
    if (!this.canApplyMandatoryFollowUps(employee, date, shiftType))
      return false;
    return true;
  }

  private createAssignment(
    employee: Employee,
    shiftType: ShiftType,
    dateStr: string,
    isFollowUp = false,
  ): void {
    const assignment: ShiftAssignment = {
      employeeId: employee.id,
      shiftId: shiftType.id,
      date: dateStr,
      locked: false,
      isFollowUp,
    };
    this.assignments.push(assignment);
    this.teamWorkloads[employee.teamId] =
      (this.teamWorkloads[employee.teamId] || 0) + 1;
    const duration = this.calculateShiftDuration(shiftType);
    this.employeeWorkloads[employee.id].hours += duration;
    this.employeeWorkloads[employee.id].shifts += 1;
    this.employeeWorkloads[employee.id].daysWorkedThisPeriod[dateStr] = true;
    if (
      employee.employeeType === "azubi" &&
      typeof employee.lehrjahr === "number" &&
      this.apprenticeShiftCounts[employee.lehrjahr]?.[shiftType.id]
    ) {
      this.apprenticeShiftCounts[employee.lehrjahr][shiftType.id][employee.id] =
        (this.apprenticeShiftCounts[employee.lehrjahr][shiftType.id][
          employee.id
        ] || 0) + 1;
    }
  }

  private selectCandidate(
    date: Date,
    shiftType: ShiftType,
    dateStr: string,
  ): Employee | null {
    const sorted = this.options.employees.slice().sort((a, b) => {
      const ratioA =
        this.teamTargets[a.teamId] > 0
          ? (this.teamWorkloads[a.teamId] || 0) / this.teamTargets[a.teamId]
          : Number.POSITIVE_INFINITY;
      const ratioB =
        this.teamTargets[b.teamId] > 0
          ? (this.teamWorkloads[b.teamId] || 0) / this.teamTargets[b.teamId]
          : Number.POSITIVE_INFINITY;
      if (ratioA !== ratioB) return ratioA - ratioB;
      const loadDiff =
        this.employeeWorkloads[a.id].hours - this.employeeWorkloads[b.id].hours;
      if (loadDiff !== 0) return loadDiff;
      const suitA = a.shiftSuitability?.[shiftType.id] ?? 0;
      const suitB = b.shiftSuitability?.[shiftType.id] ?? 0;
      return suitB - suitA;
    });

    const preferred: Employee[] = [];
    const others: Employee[] = [];
    for (const emp of sorted) {
      if (
        emp.employeeType === "azubi" &&
        typeof emp.lehrjahr === "number" &&
        this.apprenticesByYear[emp.lehrjahr]?.length > 1
      ) {
        const counts = this.apprenticeShiftCounts[emp.lehrjahr]?.[shiftType.id];
        if (counts) {
          const minCount = Math.min(...Object.values(counts));
          if ((counts[emp.id] || 0) === minCount) {
            preferred.push(emp);
          } else {
            others.push(emp);
          }
        } else {
          preferred.push(emp);
        }
      } else {
        preferred.push(emp);
      }
    }
    const candidates = [...preferred, ...others];
    for (const employee of candidates) {
      if (this.canAssign(employee, date, shiftType, dateStr)) {
        return employee;
      }
    }
    return null;
  }

  private selectAnyCandidate(
    date: Date,
    shiftType: ShiftType,
    dateStr: string,
  ): Employee | null {
    for (const emp of this.options.employees) {
      if (!emp.allowedShifts.includes(shiftType.id)) continue;
      if (!this.isEmployeeAvailable(emp, date, shiftType)) continue;
      if (
        this.assignments.some(
          (a) => a.employeeId === emp.id && a.date === dateStr && !a.isFollowUp,
        )
      )
        continue;
      return emp;
    }
    return null;
  }

  public schedule(): ScheduleResult {
    const startDate = new Date(this.options.startDate);
    const endDate = new Date(this.options.endDate);

    const getPriorityGroups = (): ShiftType[][] => {
      const group3And4: ShiftType[] = [];
      const group2: ShiftType[] = [];
      const group0And1: ShiftType[] = [];
      const others: ShiftType[] = [];
      for (const st of this.options.shiftTypes) {
        const name = st.name.trim();
        if (name.startsWith("3") || name.startsWith("4")) {
          group3And4.push(st);
        } else if (name.startsWith("2")) {
          group2.push(st);
        } else if (name.startsWith("0") || name.startsWith("1")) {
          group0And1.push(st);
        } else {
          others.push(st);
        }
      }
      group0And1.sort((a, b) => {
        if (a.name === "1. VM") return -1;
        if (b.name === "1. VM") return 1;
        if (a.name === "0.") return 1;
        if (b.name === "0.") return -1;
        return a.name.localeCompare(b.name);
      });
      return [group3And4, group2, group0And1, others];
    };

    const weekStart = new Date(startDate);
    let firstWeek = true;
    while (weekStart <= endDate) {
      if (!firstWeek) {
        this.rotateApprentices();
      }
      firstWeek = false;

      const weekDays: Date[] = [];
      const d = new Date(weekStart);
      for (let i = 0; i < 7 && d <= endDate; i++) {
        const weekday = this.getWeekdayName(d);
        if (weekday) {
          weekDays.push(new Date(d));
        }
        d.setDate(d.getDate() + 1);
      }

      const groups = getPriorityGroups();
      for (const group of groups) {
        for (const day of weekDays) {
          const weekday = this.getWeekdayName(day);
          if (!weekday) continue;
          const dateStr = day.toISOString().split("T")[0];
          for (const shiftType of group) {
            const need = shiftType.weeklyNeeds[weekday] ?? 0;
            let assignedCount = this.assignments.filter(
              (a) => a.date === dateStr && a.shiftId === shiftType.id,
            ).length;
            while (assignedCount < need) {
              let employee: Employee | null = null;

              if (this.zeroShiftId && shiftType.id === this.zeroShiftId) {
                const list = this.vmAssignmentsByDate[dateStr];
                let matched = false;
                if (list) {
                  for (let i = 0; i < list.length; i++) {
                    const emp = this.options.employees.find(
                      (e) => e.id === list[i],
                    );
                    if (emp && this.canAssign(emp, day, shiftType, dateStr)) {
                      employee = emp;
                      list.splice(i, 1);
                      matched = true;
                      break;
                    }
                  }
                }
                if (!matched && list && list.length > 0) {
                  this.conflicts.push(
                    `0. kann nicht von derselben Person wie 1. VM ausgeführt werden am ${dateStr}`,
                  );
                }
              }

              if (
                !employee &&
                this.firstVmShiftId &&
                this.zeroShiftId &&
                shiftType.id === this.firstVmShiftId
              ) {
                const zeroAssign = this.assignments.find(
                  (a) =>
                    a.date === dateStr &&
                    a.shiftId === this.zeroShiftId &&
                    !a.isFollowUp,
                );
                if (zeroAssign) {
                  const emp = this.options.employees.find(
                    (e) => e.id === zeroAssign.employeeId,
                  );
                  if (emp && this.canAssign(emp, day, shiftType, dateStr)) {
                    employee = emp;
                  } else if (emp) {
                    this.conflicts.push(
                      `1. VM kann nicht von derselben Person wie 0. ausgeführt werden am ${dateStr}`,
                    );
                  }
                }
              }

              if (!employee) {
                employee = this.selectCandidate(day, shiftType, dateStr);
              }
              if (!employee) {
                employee = this.selectAnyCandidate(day, shiftType, dateStr);
              }
              if (employee) {
                this.createAssignment(employee, shiftType, dateStr);
                if (shiftType.id === this.firstVmShiftId) {
                  if (!this.vmAssignmentsByDate[dateStr]) {
                    this.vmAssignmentsByDate[dateStr] = [];
                  }
                  this.vmAssignmentsByDate[dateStr].push(employee.id);
                }
                this.applyMandatoryFollowUps(employee, day, shiftType);
                assignedCount++;
              } else {
                this.conflicts.push(
                  `Keine verfügbare Person für Schicht ${shiftType.name} am ${dateStr}`,
                );
                break;
              }
            }
          }
        }
      }

      weekStart.setDate(weekStart.getDate() + 7);
    }

    return {
      assignments: this.assignments,
      conflicts: Array.from(new Set(this.conflicts)),
      statistics: {
        totalAssignments: this.assignments.length,
        unassignedShifts: Array.from(new Set(this.conflicts)).length,
        employeeWorkloads: this.employeeWorkloads,
        teamWorkloads: this.teamWorkloads,
      },
    };
  }
}

export function generateShiftSchedule(
  options: ScheduleOptions,
): ScheduleResult {
  const scheduler = new ShiftScheduler(options);
  return scheduler.schedule();
}
