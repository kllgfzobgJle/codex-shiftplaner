import { useState } from 'react';
import { Button } from '@/components/ui/button';
import type { Employee, Absence } from '@/lib/types';

interface AbsenceCalendarProps {
  employees: Employee[];
  absences: Absence[];
  onRangeSelect?: (employeeId: string, startDate: string, endDate: string) => void;
  onAbsenceClick?: (absence: Absence) => void;
}

export function AbsenceCalendar({ employees, absences, onRangeSelect, onAbsenceClick }: AbsenceCalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  const [selectedCells, setSelectedCells] = useState<Set<string>>(new Set());
  const [dragStart, setDragStart] = useState<{ empId: string; date: string } | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const daysInMonth = new Date(
    currentMonth.getFullYear(),
    currentMonth.getMonth() + 1,
    0,
  ).getDate();

  const daysArray = Array.from({ length: daysInMonth }, (_, i) =>
    new Date(currentMonth.getFullYear(), currentMonth.getMonth(), i + 1),
  );

  const prevMonth = () =>
    setCurrentMonth(
      new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1),
    );
  const nextMonth = () =>
    setCurrentMonth(
      new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1),
    );

  const isAbsent = (
    employeeId: string,
    date: string,
  ): Absence | undefined => {
    return absences.find(
      (a) =>
        a.employeeId === employeeId &&
        date >= a.startDate &&
        date <= a.endDate,
    );
  };

  const startDrag = (employeeId: string, date: string) => {
    const absence = isAbsent(employeeId, date);
    if (absence) {
      onAbsenceClick?.(absence);
      return;
    }
    setDragStart({ empId: employeeId, date });
    setIsDragging(true);
    setSelectedCells(new Set([`${employeeId}-${date}`]));
  };

  const updateDrag = (employeeId: string, date: string) => {
    if (!isDragging || !dragStart || dragStart.empId !== employeeId) return;
    let start = new Date(dragStart.date);
    let end = new Date(date);
    if (start > end) {
      const tmp = start;
      start = end;
      end = tmp;
    }
    const range = new Set<string>();
    const cur = new Date(start);
    while (cur <= end) {
      const ds = cur.toISOString().split('T')[0];
      range.add(`${employeeId}-${ds}`);
      cur.setDate(cur.getDate() + 1);
    }
    setSelectedCells(range);
  };

  const endDrag = (employeeId: string, date: string) => {
    if (!isDragging || !dragStart || dragStart.empId !== employeeId) {
      setIsDragging(false);
      setDragStart(null);
      setSelectedCells(new Set());
      return;
    }
    const startDate = dragStart.date <= date ? dragStart.date : date;
    const endDate = dragStart.date <= date ? date : dragStart.date;
    setIsDragging(false);
    setDragStart(null);
    setSelectedCells(new Set());
    if (onRangeSelect) {
      onRangeSelect(employeeId, startDate, endDate);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Button variant="outline" size="sm" onClick={prevMonth}>
          Zurück
        </Button>
        <div className="font-medium">
          {currentMonth.toLocaleDateString('de-DE', {
            month: 'long',
            year: 'numeric',
          })}
        </div>
        <Button variant="outline" size="sm" onClick={nextMonth}>
          Weiter
        </Button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th className="border p-2 bg-gray-50 text-left font-medium min-w-[120px]">
                Mitarbeiter
              </th>
              {daysArray.map((d) => (
                <th
                  key={d.toISOString()}
                  className="border p-1 bg-gray-50 text-center text-xs min-w-[40px]"
                >
                  {d.getDate()}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {employees.map((emp) => (
              <tr key={emp.id}>
                <td className="border p-1 bg-gray-50 text-sm font-medium">
                  {emp.firstName} {emp.lastName}
                </td>
                {daysArray.map((d) => {
                  const dateStr = d.toISOString().split('T')[0];
                  const absence = isAbsent(emp.id, dateStr);
                  return (
                    <td
                      key={dateStr}
                      className={`border p-1 text-center text-xs min-w-[40px] ${
                        absence
                          ? 'bg-red-100'
                          : selectedCells.has(`${emp.id}-${dateStr}`)
                            ? 'bg-blue-100'
                            : ''
                      }`}
                      title={absence?.reason || ''}
                      onMouseDown={() => startDrag(emp.id, dateStr)}
                      onMouseEnter={() => updateDrag(emp.id, dateStr)}
                      onMouseUp={() => endDrag(emp.id, dateStr)}
                    >
                      {absence ? 'X' : ''}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
