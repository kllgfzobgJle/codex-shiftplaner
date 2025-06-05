'use client';

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import type { Employee, Team, ShiftType, LearningYearQualification, ShiftRule, Absence } from '@/lib/types';
import {
  getEmployees,
  getTeams,
  getShiftTypes,
  getLearningYearQualifications,
  getShiftRules,
  getAbsences,
} from '@/lib/dataManager';
import { createDefaultAvailability } from '@/lib/createDefaultAvailability';

interface DataContextType {
  employees: Employee[];
  teams: Team[];
  shiftTypes: ShiftType[];
  learningYearQualifications: LearningYearQualification[];
  shiftRules: ShiftRule[];
  absences: Absence[];
  refreshData: () => void;
}

const DataContext = createContext<DataContextType | null>(null);

export function DataProvider({ children }: { children: ReactNode }) {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [shiftTypes, setShiftTypes] = useState<ShiftType[]>([]);
  const [learningYearQualifications, setLearningYearQualifications] = useState<LearningYearQualification[]>([]);
  const [shiftRules, setShiftRules] = useState<ShiftRule[]>([]);
  const [absences, setAbsences] = useState<Absence[]>([]);

  const refreshData = useCallback(() => {
    const teamsData = getTeams();
    const shiftTypesData = getShiftTypes();
    const learningYearData = getLearningYearQualifications();
    const employeesData = getEmployees().map(emp => {
      if (emp.employeeType === 'azubi' && typeof emp.lehrjahr === 'number') {
        const qualification = learningYearData.find(q => q.jahr === emp.lehrjahr);
        if (qualification) {
          const allowed = shiftTypesData.reduce<Record<string, boolean>>((acc, st) => {
            acc[st.id] = qualification.qualifiedShiftTypes.includes(st.id);
            return acc;
          }, {});
          return {
            ...emp,
            availability: {
              ...createDefaultAvailability(),
              ...qualification.defaultAvailability,
            },
            Shiftsallowed: allowed,
          } as Employee;
        }
      }
      return emp;
    });

    setEmployees(employeesData);
    setTeams(teamsData);
    setShiftTypes(shiftTypesData);
    setLearningYearQualifications(learningYearData);
    setShiftRules(getShiftRules());
    setAbsences(getAbsences());
  }, []);

  useEffect(() => {
    refreshData();
  }, [refreshData]);

  return (
    <DataContext.Provider
      value={{
        employees,
        teams,
        shiftTypes,
        learningYearQualifications,
        shiftRules,
        absences,
        refreshData,
      }}
    >
      {children}
    </DataContext.Provider>
  );
}

export function useData() {
  const context = useContext(DataContext);
  if (!context) {
    throw new Error('useData must be used within a DataProvider');
  }
  return context;
}
