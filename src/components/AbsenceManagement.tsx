'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card } from '@/components/ui/card';
import { Plus, Edit } from 'lucide-react';
import { useData } from './DataProvider';
import { useToast } from '@/hooks/use-toast';
import { saveAbsence, updateAbsence, deleteAbsence } from '@/lib/dataManager';
import type { Absence } from '@/lib/types';
import { AbsenceCalendar } from './AbsenceCalendar';

interface AbsenceFormData {
  employeeId: string;
  startDate: string;
  endDate: string;
  reason: string;
}

export function AbsenceManagement() {
  const { employees, absences, refreshData } = useData();
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingAbsence, setEditingAbsence] = useState<Absence | null>(null);
  const [formData, setFormData] = useState<AbsenceFormData>({
    employeeId: '',
    startDate: '',
    endDate: '',
    reason: '',
  });

  const resetForm = () => {
    setFormData({ employeeId: '', startDate: '', endDate: '', reason: '' });
    setEditingAbsence(null);
  };

  const handleOpenDialog = (absence?: Absence) => {
    if (absence) {
      setEditingAbsence(absence);
      setFormData({
        employeeId: absence.employeeId,
        startDate: absence.startDate,
        endDate: absence.endDate,
        reason: absence.reason || '',
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
    if (!formData.employeeId || !formData.startDate || !formData.endDate) {
      toast({ title: 'Fehler', description: 'Bitte alle Pflichtfelder ausfüllen.', variant: 'destructive' });
      return;
    }

    try {
      if (editingAbsence) {
        updateAbsence(editingAbsence.id, formData);
        toast({ title: 'Erfolgreich', description: 'Abwesenheit wurde aktualisiert.' });
      } else {
        saveAbsence(formData);
        toast({ title: 'Erfolgreich', description: 'Abwesenheit wurde hinzugefügt.' });
      }
      refreshData();
      handleCloseDialog();
    } catch (error) {
      toast({ title: 'Fehler', description: 'Fehler beim Speichern der Abwesenheit.', variant: 'destructive' });
    }
  };

  const handleDelete = (absence: Absence) => {
    if (window.confirm('Abwesenheit wirklich löschen?')) {
      deleteAbsence(absence.id);
      refreshData();
    }
  };

  const getEmployeeName = (id: string) => {
    const e = employees.find(emp => emp.id === id);
    return e ? `${e.firstName} ${e.lastName}` : 'Unbekannt';
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => handleOpenDialog()}>
              <Plus className="w-4 h-4 mr-2" /> Abwesenheit erfassen
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingAbsence ? 'Abwesenheit bearbeiten' : 'Abwesenheit erfassen'}</DialogTitle>
              <DialogDescription>Zeitraum der Abwesenheit eingeben</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="employee">Mitarbeiter *</Label>
                <Select value={formData.employeeId} onValueChange={(v) => setFormData(prev => ({ ...prev, employeeId: v }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Mitarbeiter wählen" />
                  </SelectTrigger>
                  <SelectContent>
                    {employees.map(emp => (
                      <SelectItem key={emp.id} value={emp.id}>{emp.firstName} {emp.lastName}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="start">Von *</Label>
                  <Input id="start" type="date" value={formData.startDate} onChange={(e) => setFormData(prev => ({ ...prev, startDate: e.target.value }))} />
                </div>
                <div>
                  <Label htmlFor="end">Bis *</Label>
                  <Input id="end" type="date" value={formData.endDate} onChange={(e) => setFormData(prev => ({ ...prev, endDate: e.target.value }))} />
                </div>
              </div>
              <div>
                <Label htmlFor="reason">Grund</Label>
                <Input id="reason" value={formData.reason} onChange={(e) => setFormData(prev => ({ ...prev, reason: e.target.value }))} />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={handleCloseDialog}>Abbrechen</Button>
                {editingAbsence && (
                  <Button type="button" variant="destructive" onClick={() => { handleDelete(editingAbsence); handleCloseDialog(); }}>Löschen</Button>
                )}
                <Button type="submit">{editingAbsence ? 'Aktualisieren' : 'Hinzufügen'}</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
      <Tabs defaultValue="calendar" className="space-y-4">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="calendar">Kalender</TabsTrigger>
          <TabsTrigger value="list">Liste</TabsTrigger>
        </TabsList>
        <TabsContent value="calendar">
          <Card>
            <AbsenceCalendar employees={employees} absences={absences} />
          </Card>
        </TabsContent>
        <TabsContent value="list">
          <Card>
            <div className="border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Mitarbeiter</TableHead>
                    <TableHead>Von</TableHead>
                    <TableHead>Bis</TableHead>
                    <TableHead>Grund</TableHead>
                    <TableHead className="text-right">Aktionen</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {absences.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-4 text-gray-500">Keine Abwesenheiten erfasst.</TableCell>
                    </TableRow>
                  ) : (
                    absences.map(a => (
                      <TableRow key={a.id}>
                        <TableCell className="font-medium">{getEmployeeName(a.employeeId)}</TableCell>
                        <TableCell>{a.startDate}</TableCell>
                        <TableCell>{a.endDate}</TableCell>
                        <TableCell>{a.reason}</TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="sm" onClick={() => handleOpenDialog(a)}>
                            <Edit className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
