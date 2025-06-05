'use client';

import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Card } from '@/components/ui/card';
import { Plus, Edit, Copy, Download, Upload } from 'lucide-react';
import { useData } from './DataProvider';
import { useToast } from '@/hooks/use-toast';
import { saveEmployee, updateEmployee, deleteEmployee } from '@/lib/dataManager';
import { employeesToCSV, csvToEmployees, downloadCSV } from '@/lib/csvUtils';
import type { Employee } from '@/lib/types';
import { WEEKDAYS, HALF_DAYS, WEEKDAYS_SHORT, HALF_DAYS_GERMAN } from '@/lib/types';
import { createDefaultAvailability } from '@/lib/createDefaultAvailability';
import { useSortableData } from '@/hooks/useSortableData';

interface EmployeeFormData {
  firstName: string;
  lastName: string;
  kuerzel: string;
  employeeType: 'ausgelernt' | 'azubi';
  lehrjahr?: number;
  grade: number;
  teamId: string;
  specificShiftPercentage?: number;
  Shiftsallowed: Record<string, boolean>;
  ShiftsSuitability: Record<string, number>;
  availability: Record<string, boolean>;
  ruleIds: Record<string, boolean>;
}

export function EmployeeManagement() {
  const { employees, teams, shiftTypes, learningYearQualifications, shiftRules, refreshData } = useData();
  const { toast } = useToast();
  const { items: sortedEmployees, requestSort, sortConfig } = useSortableData(employees);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [formData, setFormData] = useState<EmployeeFormData>(() => {
    const defaultAllowed = shiftTypes.reduce<Record<string, boolean>>((acc, st) => {
      acc[st.id] = false;
      return acc;
    }, {});
    const defaultSuit = shiftTypes.reduce<Record<string, number>>((acc, st) => {
      acc[st.id] = 0;
      return acc;
    }, {});
    const defaultRules = shiftRules.reduce<Record<string, boolean>>((acc, r) => {
      acc[r.id] = false;
      return acc;
    }, {});
    return {
      firstName: '',
      lastName: '',
      kuerzel: '',
      employeeType: 'ausgelernt',
      grade: 100,
      teamId: '',
      Shiftsallowed: defaultAllowed,
      ShiftsSuitability: defaultSuit,
      availability: createDefaultAvailability(),
      ruleIds: defaultRules,
    };
  });

  const resetForm = () => {
    const defaultAllowed = shiftTypes.reduce<Record<string, boolean>>((acc, st) => {
      acc[st.id] = false;
      return acc;
    }, {});
    const defaultSuit = shiftTypes.reduce<Record<string, number>>((acc, st) => {
      acc[st.id] = 0;
      return acc;
    }, {});
    const defaultRules = shiftRules.reduce<Record<string, boolean>>((acc, r) => {
      acc[r.id] = false;
      return acc;
    }, {});
    setFormData({
      firstName: '',
      lastName: '',
      kuerzel: '',
      employeeType: 'ausgelernt',
      grade: 100,
      teamId: '',
      Shiftsallowed: defaultAllowed,
      ShiftsSuitability: defaultSuit,
      availability: createDefaultAvailability(),
      ruleIds: defaultRules,
    });
    setEditingEmployee(null);
  };



  const handleOpenDialog = (employee?: Employee) => {
    if (employee) {
      setEditingEmployee(employee);
      setFormData({
        firstName: employee.firstName,
        lastName: employee.lastName,
        kuerzel: employee.kuerzel || '',
        employeeType: employee.employeeType,
        lehrjahr: employee.lehrjahr,
        grade: employee.grade,
        teamId: employee.teamId,
        specificShiftPercentage: employee.specificShiftPercentage,
        Shiftsallowed: shiftTypes.reduce<Record<string, boolean>>((acc, st) => {
          acc[st.id] = employee.Shiftsallowed?.[st.id] ?? false;
          return acc;
        }, {}),
        ShiftsSuitability: shiftTypes.reduce<Record<string, number>>((acc, st) => {
          const allowed = employee.Shiftsallowed?.[st.id] ?? false;
          acc[st.id] = allowed ? employee.ShiftsSuitability?.[st.id] ?? 3 : 0;
          return acc;
        }, {}),
        availability: employee.availability,
        ruleIds: shiftRules.reduce<Record<string, boolean>>((acc, r) => {
          acc[r.id] = employee.ruleIds?.[r.id] ?? false;
          return acc;
        }, {}),
      });
    } else {
      resetForm();
    }
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    resetForm();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.firstName || !formData.lastName || !formData.teamId) {
      toast({
        title: "Fehler",
        description: "Bitte alle Pflichtfelder ausfüllen.",
        variant: "destructive",
      });
      return;
    }

    const completedAvailability: Record<string, boolean> = {
      ...createDefaultAvailability(),
      ...formData.availability,
    };
    for (const key of Object.keys(completedAvailability)) {
      if (formData.availability[key] === undefined) {
        completedAvailability[key] = true;
      }
    }

    const finalData = {
      ...formData,
      availability: completedAvailability,
    };

    try {
      if (editingEmployee) {
        updateEmployee(editingEmployee.id, finalData);
        toast({
          title: "Erfolgreich",
          description: "Mitarbeiter wurde aktualisiert.",
        });
      } else {
        saveEmployee(finalData);
        toast({
          title: "Erfolgreich",
          description: "Mitarbeiter wurde hinzugefügt.",
        });
      }
      refreshData();
      handleCloseDialog();
    } catch (error) {
      toast({
        title: "Fehler",
        description: "Fehler beim Speichern des Mitarbeiters.",
        variant: "destructive",
      });
    }
  };

  const handleDelete = (employee: Employee) => {
    if (window.confirm(`Möchten Sie ${employee.firstName} ${employee.lastName} wirklich löschen?`)) {
      try {
        deleteEmployee(employee.id);
        toast({
          title: "Erfolgreich",
          description: "Mitarbeiter wurde gelöscht.",
        });
        refreshData();
      } catch (error) {
        toast({
          title: "Fehler",
          description: "Fehler beim Löschen des Mitarbeiters.",
          variant: "destructive",
        });
      }
    }
  };

  const handleDuplicate = (employee: Employee) => {
    setFormData({
      firstName: employee.firstName,
      lastName: `${employee.lastName} (Kopie)`,
      kuerzel: employee.kuerzel ? `${employee.kuerzel.substring(0, 3)}K` : '',
      employeeType: employee.employeeType,
      lehrjahr: employee.lehrjahr,
      grade: employee.grade,
      teamId: employee.teamId,
      specificShiftPercentage: employee.specificShiftPercentage,
      Shiftsallowed: shiftTypes.reduce<Record<string, boolean>>((acc, st) => {
        acc[st.id] = employee.Shiftsallowed?.[st.id] ?? false;
        return acc;
      }, {}),
      ShiftsSuitability: shiftTypes.reduce<Record<string, number>>((acc, st) => {
        const allowed = employee.Shiftsallowed?.[st.id] ?? false;
        acc[st.id] = allowed ? employee.ShiftsSuitability?.[st.id] ?? 3 : 0;
        return acc;
      }, {}),
      availability: employee.availability,
      ruleIds: shiftRules.reduce<Record<string, boolean>>((acc, r) => {
        acc[r.id] = employee.ruleIds?.[r.id] ?? false;
        return acc;
      }, {}),
    });
    setEditingEmployee(null);
    setIsDialogOpen(true);
  };

  const handleAvailabilityChange = (dayKey: string, checked: boolean) => {
    setFormData(prev => ({
      ...prev,
      availability: {
        ...prev.availability,
        [dayKey]: checked,
      },
    }));
  };

  const handleShiftTypeChange = (shiftTypeId: string, checked: boolean) => {
    setFormData(prev => ({
      ...prev,
      Shiftsallowed: { ...prev.Shiftsallowed, [shiftTypeId]: checked },
      ShiftsSuitability: {
        ...prev.ShiftsSuitability,
        [shiftTypeId]: checked ? prev.ShiftsSuitability[shiftTypeId] ?? 3 : 0,
      },
    }));
  };

  // Update availability when lehrjahr changes for azubi
  const handleLehrjahrChange = (lehrjahr: number) => {
    const qualification = learningYearQualifications.find(q => q.jahr === lehrjahr);
    setFormData(prev => ({
      ...prev,
      lehrjahr,
      availability: qualification?.defaultAvailability || {},
      Shiftsallowed: shiftTypes.reduce<Record<string, boolean>>((acc, st) => {
        acc[st.id] = qualification?.qualifiedShiftTypes.includes(st.id) ?? false;
        return acc;
      }, {}),
      ShiftsSuitability: shiftTypes.reduce<Record<string, number>>((acc, st) => {
        const allowed = qualification?.qualifiedShiftTypes.includes(st.id) ?? false;
        acc[st.id] = allowed ? prev.ShiftsSuitability[st.id] ?? 3 : 0;
        return acc;
      }, {}),
    }));
  };


  const getTeamName = (teamId: string) => {
    const team = teams.find(t => t.id === teamId);
    return team ? team.name : 'Unbekannt';
  };

  // CSV Export
  const handleExportCSV = () => {
    try {
      const csvContent = employeesToCSV(employees);
      const filename = `mitarbeiter_${new Date().toISOString().split('T')[0]}.csv`;
      downloadCSV(csvContent, filename);
      toast({
        title: "Export erfolgreich",
        description: "Mitarbeiterdaten wurden als CSV exportiert.",
      });
    } catch (error) {
      toast({
        title: "Export fehlgeschlagen",
        description: "Fehler beim Exportieren der Mitarbeiterdaten.",
        variant: "destructive",
      });
    }
  };

  // CSV Import
  const handleImportCSV = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const csvContent = e.target?.result as string;
        const importedEmployees = csvToEmployees(csvContent);

        if (importedEmployees.length === 0) {
          toast({
            title: "Import fehlgeschlagen",
            description: "Keine gültigen Mitarbeiterdaten in der CSV-Datei gefunden.",
            variant: "destructive",
          });
          return;
        }

        // Save imported employees
        for (const employeeData of importedEmployees) {
          saveEmployee(employeeData);
        }

        refreshData();
        toast({
          title: "Import erfolgreich",
          description: `${importedEmployees.length} Mitarbeiter wurden importiert.`,
        });
      } catch (error) {
        toast({
          title: "Import fehlgeschlagen",
          description: "Fehler beim Verarbeiten der CSV-Datei. Bitte überprüfen Sie das Format.",
          variant: "destructive",
        });
      }
    };

    reader.readAsText(file);
    event.target.value = '';
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div className="flex space-x-2">
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            onChange={handleImportCSV}
            className="hidden"
          />
          <Button
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="w-4 h-4 mr-2" />
            Import CSV
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportCSV}
          >
            <Download className="w-4 h-4 mr-2" />
            Export CSV
          </Button>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => handleOpenDialog()}>
              <Plus className="w-4 h-4 mr-2" />
              Mitarbeiter hinzufügen
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingEmployee ? 'Mitarbeiter bearbeiten' : 'Mitarbeiter hinzufügen'}
              </DialogTitle>
              <DialogDescription>
                Erfassen Sie die Mitarbeiterdaten und Verfügbarkeiten.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="firstName">Vorname *</Label>
                  <Input
                    id="firstName"
                    value={formData.firstName}
                    onChange={(e) => setFormData(prev => ({ ...prev, firstName: e.target.value }))}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="lastName">Nachname *</Label>
                  <Input
                    id="lastName"
                    value={formData.lastName}
                    onChange={(e) => setFormData(prev => ({ ...prev, lastName: e.target.value }))}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="kuerzel">Kürzel (max. 4 Zeichen)</Label>
                  <Input
                    id="kuerzel"
                    value={formData.kuerzel}
                    onChange={(e) => setFormData(prev => ({ ...prev, kuerzel: e.target.value.slice(0, 4).toUpperCase() }))}
                    maxLength={4}
                  />
                </div>
                <div>
                  <Label htmlFor="employeeType">Mitarbeitertyp *</Label>
                  <Select
                    value={formData.employeeType}
                    onValueChange={(value: 'ausgelernt' | 'azubi') => {
                      setFormData(prev => ({
                        ...prev,
                        employeeType: value,
                        lehrjahr: value === 'azubi' ? prev.lehrjahr : undefined,
                      }));
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ausgelernt">Ausgelernt</SelectItem>
                      <SelectItem value="azubi">Auszubildender</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {formData.employeeType === 'azubi' && (
                  <div>
                    <Label htmlFor="lehrjahr">Lehrjahr *</Label>
                    <Select
                      value={formData.lehrjahr?.toString() || ''}
                      onValueChange={(value) => handleLehrjahrChange(Number(value))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Lehrjahr wählen" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">1. Lehrjahr</SelectItem>
                        <SelectItem value="2">2. Lehrjahr</SelectItem>
                        <SelectItem value="3">3. Lehrjahr</SelectItem>
                        <SelectItem value="4">4. Lehrjahr</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div>
                  <Label htmlFor="grade">Anstellungsgrad (%) *</Label>
                  <Input
                    id="grade"
                    type="number"
                    min="1"
                    max="100"
                    value={formData.grade}
                    onChange={(e) => setFormData(prev => ({ ...prev, grade: Number(e.target.value) }))}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="teamId">Team *</Label>
                  <Select
                    value={formData.teamId}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, teamId: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Team wählen" />
                    </SelectTrigger>
                    <SelectContent>
                      {teams.map(team => (
                        <SelectItem key={team.id} value={team.id}>
                          {team.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="specificShiftPercentage">Individueller Schichtanteil (%)</Label>
                  <Input
                    id="specificShiftPercentage"
                    type="number"
                    min="0"
                    max="100"
                    value={formData.specificShiftPercentage ?? ''}
                    onChange={(e) =>
                      setFormData(prev => ({
                        ...prev,
                        specificShiftPercentage:
                          e.target.value === ''
                            ? undefined
                            : Number(e.target.value),
                      }))
                    }
                    placeholder="Leer = Team-Standard"
                  />
                </div>
              </div>

              <div>
                <Label>Erlaubte Schichten</Label>
                <Card className="p-4 mt-2">
                  <div className="grid grid-cols-3 gap-2">
                    {shiftTypes.map(shiftType => (
                      <div key={shiftType.id} className="flex items-center space-x-2">
                        <Checkbox
                          id={`shift-${shiftType.id}`}
                          checked={formData.Shiftsallowed[shiftType.id] === true}
                          onCheckedChange={(checked) => handleShiftTypeChange(shiftType.id, !!checked)}
                        />
                        <Label htmlFor={`shift-${shiftType.id}`} className="text-sm">
                          {shiftType.name}
                        </Label>
                      </div>
                    ))}
                  </div>
                </Card>
              </div>

              <div>
                <Label>Schicht-Eignung (0-5)</Label>
                <Card className="p-4 mt-2">
                  <div className="grid grid-cols-3 gap-4">
                    {shiftTypes.map(st => (
                      <div key={st.id} className="space-y-1">
                        <Label htmlFor={`suit-${st.id}`} className="text-sm">
                          {st.name}
                        </Label>
                        <Input
                          id={`suit-${st.id}`}
                          type="number"
                          min="0"
                          max="5"
                          value={formData.ShiftsSuitability[st.id] ?? 0}
                          disabled={!formData.Shiftsallowed[st.id]}
                          onChange={(e) =>
                            setFormData(prev => ({
                              ...prev,
                              ShiftsSuitability: {
                                ...prev.ShiftsSuitability,
                                [st.id]: Math.min(5, Math.max(0, Number(e.target.value)))
                              }
                            }))
                          }
                        />
                      </div>
                    ))}
                  </div>
                </Card>
              </div>

              <div>
                <Label>Individuelle Regeln</Label>
                <Card className="p-4 mt-2 max-h-40 overflow-y-auto">
                  <div className="space-y-2">
                    {shiftRules.map(rule => (
                      <div key={rule.id} className="flex items-center space-x-2">
                        <Checkbox
                          id={`erule-${rule.id}`}
                          checked={formData.ruleIds[rule.id] === true}
                          onCheckedChange={(checked) =>
                            setFormData(prev => ({
                              ...prev,
                              ruleIds: { ...prev.ruleIds, [rule.id]: !!checked },
                            }))
                          }
                        />
                        <Label htmlFor={`erule-${rule.id}`} className="text-sm">
                          {rule.name || rule.type}
                        </Label>
                      </div>
                    ))}
                    {shiftRules.length === 0 && (
                      <p className="text-sm text-gray-500">Keine Regeln definiert.</p>
                    )}
                  </div>
                </Card>
              </div>

              <div>
                <Label>Verfügbarkeit</Label>
                <Card className="p-4 mt-2">
                  <div className="grid grid-cols-6 gap-2 text-center">
                    <div />
                    {WEEKDAYS.map(day => (
                      <div key={day} className="font-medium text-sm">
                        {WEEKDAYS_SHORT[day]}
                      </div>
                    ))}
                    {HALF_DAYS.map(halfDay => (
                      <div key={halfDay} className="contents">
                        <div className="text-sm font-medium text-right pr-2">
                          {HALF_DAYS_GERMAN[halfDay]}
                        </div>
                        {WEEKDAYS.map(day => {
                          const key = `${day}_${halfDay}`;
                          return (
                            <div key={key} className="flex justify-center">
                              <Checkbox
                                checked={formData.availability[key] !== false}
                                onCheckedChange={(checked) => handleAvailabilityChange(key, !!checked)}
                              />
                            </div>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                </Card>
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={handleCloseDialog}>
                  Abbrechen
                </Button>
                {editingEmployee && (
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={() => {
                      handleDelete(editingEmployee);
                      handleCloseDialog();
                    }}
                  >
                    Löschen
                  </Button>
                )}
                <Button type="submit">
                  {editingEmployee ? 'Aktualisieren' : 'Hinzufügen'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>
                <button type="button" onClick={() => requestSort('firstName')}>Vorname{sortConfig?.key === 'firstName' ? (sortConfig.direction === 'asc' ? ' ▲' : ' ▼') : ''}</button>
              </TableHead>
              <TableHead>
                <button type="button" onClick={() => requestSort('lastName')}>Nachname{sortConfig?.key === 'lastName' ? (sortConfig.direction === 'asc' ? ' ▲' : ' ▼') : ''}</button>
              </TableHead>
              <TableHead>
                <button type="button" onClick={() => requestSort('grade')}>Anstellungsgrad{sortConfig?.key === 'grade' ? (sortConfig.direction === 'asc' ? ' ▲' : ' ▼') : ''}</button>
              </TableHead>
              <TableHead>
                <button type="button" onClick={() => requestSort('teamId')}>Team{sortConfig?.key === 'teamId' ? (sortConfig.direction === 'asc' ? ' ▲' : ' ▼') : ''}</button>
              </TableHead>
              <TableHead className="text-right">Aktionen</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedEmployees.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-4 text-gray-500">
                  Keine Mitarbeiter gefunden.
                </TableCell>
              </TableRow>
            ) : (
              sortedEmployees.map(employee => (
                <TableRow key={employee.id}>
                  <TableCell className="font-medium">{employee.firstName}</TableCell>
                  <TableCell>{employee.lastName}</TableCell>
                  <TableCell>{employee.grade}%</TableCell>
                  <TableCell>{getTeamName(employee.teamId)}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end space-x-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleOpenDialog(employee)}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDuplicate(employee)}
                      >
                        <Copy className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
