'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Lock, Unlock, AlertTriangle, Users } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { Employee, ShiftType, ShiftAssignment, Absence, WeekDay } from '@/lib/types';
import { WEEKDAYS_SHORT } from '@/lib/types';

const WEEKDAY_MAPPING: WeekDay[] = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'];

interface ShiftCalendarGridProps {
  startDate: Date;
  endDate: Date;
  employees: Employee[];
  shiftTypes: ShiftType[];
  assignments: ShiftAssignment[];
  conflicts: string[];
  absences: Absence[];
  onAssignmentChange: (assignments: ShiftAssignment[]) => void;
}

interface CellData {
  date: string;
  shiftTypeId: string;
  employeeId?: string;
  assignment?: ShiftAssignment;
  isConflict: boolean;
}

export function ShiftCalendarGrid({
  startDate,
  endDate,
  employees,
  shiftTypes,
  assignments,
  conflicts,
  absences,
  onAssignmentChange,
}: ShiftCalendarGridProps) {
  const { toast } = useToast();
  const [editingCell, setEditingCell] = useState<CellData | null>(null);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('');

  const zeroShiftId = shiftTypes.find((st) => st.name === '0.')?.id;
  const firstVmShiftId = shiftTypes.find((st) => st.name === '1. VM')?.id;

  const getWeekdayName = (date: Date): WeekDay | null => {
    const day = date.getDay();
    const name = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][day] as WeekDay;
    return WEEKDAY_MAPPING.includes(name) ? name : null;
  };

  const isAvailable = (emp: Employee, date: Date, shift: ShiftType): boolean => {
    const abs = absences.find(a => a.employeeId === emp.id && date >= new Date(a.startDate) && date <= new Date(a.endDate));
    if (abs) return false;
    const weekday = getWeekdayName(date);
    if (!weekday) return false;
    const sHour = Number.parseInt(shift.startTime.split(':')[0]);
    const eHour = Number.parseInt(shift.endTime.split(':')[0]);
    if (sHour < 12) {
      if (emp.availability[`${weekday}_AM`] !== true) return false;
    }
    if (eHour >= 12 || (sHour >= 12 && sHour < 24)) {
      if (emp.availability[`${weekday}_PM`] !== true) return false;
    }
    if (shift.endTime < shift.startTime) {
      const next = new Date(date);
      next.setDate(date.getDate() + 1);
      const nextWeekday = getWeekdayName(next);
      if (nextWeekday && eHour > 0 && eHour < 12) {
        if (emp.availability[`${nextWeekday}_AM`] !== true) return false;
      }
    }
    return true;
  };

  // Get ordered shift types (following original priority order)
  const getOrderedShiftTypes = () => {
    const priorityOrder = ['0.', '1. VM', '2A. VM', '2B. VM', '1. NM', '2A. NM', '2B. NM', '3.', '4.'];
    const orderedShifts: ShiftType[] = [];
    const remaining = [...shiftTypes];

    for (const priorityName of priorityOrder) {
      const index = remaining.findIndex(st => st.name === priorityName);
      if (index > -1) {
        orderedShifts.push(remaining.splice(index, 1)[0]);
      }
    }

    // Add remaining shifts alphabetically
    remaining.sort((a, b) => a.name.localeCompare(b.name));
    return [...orderedShifts, ...remaining];
  };

  // Generate calendar weeks
  const generateWeeks = () => {
    const weeks: Date[][] = [];
    const currentDate = new Date(startDate);

    while (currentDate <= endDate) {
      const week: Date[] = [];
      const weekStart = new Date(currentDate);

      for (let i = 0; i < 5; i++) {
        week.push(new Date(weekStart));
        weekStart.setDate(weekStart.getDate() + 1);
      }

      weeks.push(week);
      currentDate.setDate(currentDate.getDate() + 7);
    }

    return weeks;
  };

  // Get assignment for specific date and shift
  const getAssignment = (date: string, shiftTypeId: string): ShiftAssignment | undefined => {
    return assignments.find(a =>
      a.date === date &&
      a.shiftId === shiftTypeId &&
      !a.isFollowUp
    );
  };

  // Get employee by ID
  const getEmployee = (employeeId: string): Employee | undefined => {
    return employees.find(e => e.id === employeeId);
  };

  // Check if there's a conflict for this cell
  const hasConflict = (date: string, shiftTypeId: string): boolean => {
    const shiftType = shiftTypes.find(st => st.id === shiftTypeId);
    if (!shiftType) return false;

    return conflicts.some(conflict =>
      conflict.includes(date) && conflict.includes(shiftType.name)
    );
  };

  // Handle cell click
  const handleCellClick = (date: string, shiftTypeId: string) => {
    const assignment = getAssignment(date, shiftTypeId);
    const isConflict = hasConflict(date, shiftTypeId);

    setEditingCell({
      date,
      shiftTypeId,
      employeeId: assignment?.employeeId,
      assignment,
      isConflict,
    });

    setSelectedEmployeeId(assignment?.employeeId || '');
  };

  // Handle assignment update
  const handleUpdateAssignment = () => {
    if (!editingCell) return;

    const newAssignments = [...assignments];

    // Remove existing assignment for this slot
    const existingIndex = newAssignments.findIndex(a =>
      a.date === editingCell.date &&
      a.shiftId === editingCell.shiftTypeId &&
      !a.isFollowUp
    );

    if (existingIndex > -1) {
      newAssignments.splice(existingIndex, 1);
    }

    // Add new assignment if employee selected
    if (selectedEmployeeId) {
      const emp = employees.find(e => e.id === selectedEmployeeId);
      const shift = shiftTypes.find(s => s.id === editingCell.shiftTypeId);
      if (
        !emp ||
        !shift ||
        !emp.Shiftsallowed[shift.id] ||
        !isAvailable(emp, new Date(editingCell.date), shift)
      ) {
        toast({
          title: 'Nicht möglich',
          description: 'Mitarbeiter ist für diese Schicht nicht verfügbar.',
          variant: 'destructive',
        });
        return;
      }

      const newAssignment: ShiftAssignment = {
        employeeId: selectedEmployeeId,
        shiftId: editingCell.shiftTypeId,
        date: editingCell.date,
        locked: false,
        isFollowUp: false,
      };

      newAssignments.push(newAssignment);
    }

    onAssignmentChange(newAssignments);
    setEditingCell(null);
    setSelectedEmployeeId('');

    toast({
      title: "Zuweisung aktualisiert",
      description: selectedEmployeeId ? "Mitarbeiter wurde zugewiesen." : "Zuweisung wurde entfernt.",
    });
  };

  // Toggle lock status
  const toggleLock = (assignment: ShiftAssignment) => {
    const newAssignments = assignments.map(a =>
      a.employeeId === assignment.employeeId &&
      a.date === assignment.date &&
      a.shiftId === assignment.shiftId
        ? { ...a, locked: !a.locked }
        : a
    );

    onAssignmentChange(newAssignments);

    toast({
      title: assignment.locked ? "Entsperrt" : "Gesperrt",
      description: assignment.locked ? "Zuweisung wurde entsperrt." : "Zuweisung wurde gesperrt.",
    });
  };

  // Get available employees for a shift
  const getAvailableEmployees = (date: string, shiftTypeId: string) => {
    const shiftType = shiftTypes.find((st) => st.id === shiftTypeId);
    if (!shiftType) return [];
    const d = new Date(date);

    return employees.filter((employee) => {
      if (!employee.Shiftsallowed[shiftTypeId]) return false;

      if (!isAvailable(employee, d, shiftType)) return false;

      const existingAssignments = assignments.filter(
        (a) => a.employeeId === employee.id && a.date === date && !a.isFollowUp,
      );

      if (existingAssignments.length === 0) return true;

      if (existingAssignments.length === 1) {
        const existing = existingAssignments[0];
        const pairAllowed =
          (existing.shiftId === zeroShiftId && shiftTypeId === firstVmShiftId) ||
          (existing.shiftId === firstVmShiftId && shiftTypeId === zeroShiftId);
        return pairAllowed;
      }

      return false;
    });
  };

  const orderedShiftTypes = getOrderedShiftTypes();
  const weeks = generateWeeks();

  return (
    <div className="space-y-6">
      {weeks.map((week, weekIndex) => (
        <Card key={week[0].toISOString()}>
          <CardHeader>
            <CardTitle className="text-lg">
              Woche {weekIndex + 1} (ab {new Date(week[0]).toLocaleDateString('de-DE', {
                day: '2-digit',
                month: '2-digit'
              })})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr>
                    <th className="border p-2 bg-gray-50 text-left font-medium min-w-[120px]">
                      Schicht
                    </th>
                    {week.map((date, dayIndex) => (
                      <th key={date.toISOString()} className="border p-2 bg-gray-50 text-center font-medium min-w-[100px]">
                        <div className="text-xs text-gray-600">
                          {Object.values(WEEKDAYS_SHORT)[dayIndex]}
                        </div>
                        <div className="text-sm">
                          {new Date(date).toLocaleDateString('de-DE', {
                            day: '2-digit',
                            month: '2-digit'
                          })}
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {orderedShiftTypes.map(shiftType => (
                    <tr key={shiftType.id}>
                      <td className="border p-2 bg-gray-50 font-medium">
                        <div className="text-sm">{shiftType.name}</div>
                        <div className="text-xs text-gray-500">
                          {shiftType.startTime} - {shiftType.endTime}
                        </div>
                      </td>
                      {week.map((date, dayIndex) => {
                        const dateStr = date.toISOString().split('T')[0];
                        const assignment = getAssignment(dateStr, shiftType.id);
                        const employee = assignment ? getEmployee(assignment.employeeId) : undefined;
                        const isConflict = hasConflict(dateStr, shiftType.id);
                        const weekday = getWeekdayName(date);
                        const demand = weekday ? shiftType.weeklyNeeds[weekday] ?? 0 : 0;
                        const disabled = demand === 0;

                        return (
                          <td
                            key={date.toISOString()}
                            className={`border p-1 text-center ${
                              disabled ? 'bg-gray-100 text-gray-400' : 'cursor-pointer hover:bg-gray-50'
                            } ${isConflict ? 'bg-red-50' : ''}`}
                            onClick={() => {
                              if (!disabled) handleCellClick(dateStr, shiftType.id);
                            }}
                          >
                            {employee ? (
                              <div className="space-y-1">
                                <Badge
                                  variant={assignment?.locked ? "default" : "secondary"}
                                  className="text-xs px-1 py-0"
                                >
                                  {employee.kuerzel || employee.firstName.substring(0, 2).toUpperCase()}
                                  {assignment?.isFollowUp && '(F)'}
                                </Badge>
                                <div className="flex justify-center space-x-1">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-4 w-4 p-0"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      if (assignment) toggleLock(assignment);
                                    }}
                                  >
                                    {assignment?.locked ? (
                                      <Lock className="h-3 w-3" />
                                    ) : (
                                      <Unlock className="h-3 w-3 text-gray-400" />
                                    )}
                                  </Button>
                                  {isConflict && (
                                    <AlertTriangle className="h-3 w-3 text-red-500" />
                                  )}
                                </div>
                              </div>
                            ) : (
                              <div className="text-gray-400 text-xs py-2">
                                {isConflict ? (
                                  <AlertTriangle className="h-4 w-4 mx-auto text-red-500" />
                                ) : (
                                  <Users className="h-4 w-4 mx-auto" />
                                )}
                              </div>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      ))}

      {/* Edit Assignment Dialog */}
      <Dialog open={!!editingCell} onOpenChange={() => setEditingCell(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Schichtzuweisung bearbeiten</DialogTitle>
            <DialogDescription>
              {editingCell && (
                <>
                  {shiftTypes.find(st => st.id === editingCell.shiftTypeId)?.name} am{' '}
                  {new Date(editingCell.date).toLocaleDateString('de-DE')}
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          {editingCell && (
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">Mitarbeiter auswählen</label>
                <Select
                  value={selectedEmployeeId || "none"}
                  onValueChange={(value) =>
                    setSelectedEmployeeId(value === "none" ? "" : value)
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Mitarbeiter wählen oder leer lassen" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Keine Zuweisung</SelectItem>
                    {getAvailableEmployees(editingCell.date, editingCell.shiftTypeId).map(employee => (
                      <SelectItem key={employee.id} value={employee.id}>
                        {employee.firstName} {employee.lastName} ({employee.kuerzel || 'Kein Kürzel'})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {editingCell.isConflict && (
                <div className="bg-red-50 border border-red-200 rounded-md p-3">
                  <div className="flex items-center space-x-2">
                    <AlertTriangle className="h-4 w-4 text-red-500" />
                    <span className="text-sm text-red-700">
                      Konflikt erkannt: Überprüfen Sie Regeln und Verfügbarkeiten
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingCell(null)}>
              Abbrechen
            </Button>
            <Button onClick={handleUpdateAssignment}>
              Speichern
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
