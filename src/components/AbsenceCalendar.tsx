import { useState } from 'react';
import { Button } from '@/components/ui/button';
import type { Employee, Absence } from '@/lib/types';

interface AbsenceCalendarProps {
  employees: Employee[];
  absences: Absence[];
}

export function AbsenceCalendar({ employees, absences }: AbsenceCalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

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
                  className="border p-1 bg-gray-50 text-center text-xs"
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
                      className={`border p-1 text-center text-xs ${absence ? 'bg-red-100' : ''}`}
                      title={absence?.reason || ''}
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
