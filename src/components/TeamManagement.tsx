"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useSortableData } from "@/hooks/useSortableData";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Plus, Edit, Copy, Download, Upload } from "lucide-react";
import { useData } from "./DataProvider";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { saveTeam, updateTeam, deleteTeam } from "@/lib/dataManager";
import { teamsToCSV, csvToTeams, downloadCSV } from "@/lib/csvUtils";
import type { Team } from "@/lib/types";

interface TeamFormData {
  name: string;
  overallShiftPercentage: number;
  teamLeaderId?: string;
  ruleIds: Record<string, boolean>;
}

export function TeamManagement() {
  const { teams, employees, shiftRules, refreshData } = useData();
  const { toast } = useToast();
  const { items: sortedTeams, requestSort, sortConfig } = useSortableData(teams);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);
  const [formData, setFormData] = useState<TeamFormData>(() => {
    const defaultRules = shiftRules.reduce<Record<string, boolean>>((acc, r) => {
      acc[r.id] = false;
      return acc;
    }, {});
    return {
      name: "",
      overallShiftPercentage: 60,
      teamLeaderId: undefined,
      ruleIds: defaultRules,
    };
  });

  const resetForm = () => {
    const defaultRules = shiftRules.reduce<Record<string, boolean>>((acc, r) => {
      acc[r.id] = false;
      return acc;
    }, {});
    setFormData({
      name: "",
      overallShiftPercentage: 60,
      teamLeaderId: undefined,
      ruleIds: defaultRules,
    });
    setEditingTeam(null);
  };

  const handleOpenDialog = (team?: Team) => {
    if (team) {
      setEditingTeam(team);
      setFormData({
        name: team.name,
        overallShiftPercentage: team.overallShiftPercentage,
        teamLeaderId: employees.some((e) => e.id === team.teamLeaderId)
          ? team.teamLeaderId
          : undefined,
        ruleIds: shiftRules.reduce<Record<string, boolean>>((acc, r) => {
          acc[r.id] = team.ruleIds?.[r.id] ?? false;
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

    if (
      !formData.name ||
      formData.overallShiftPercentage < 0 ||
      formData.overallShiftPercentage > 100
    ) {
      toast({
        title: "Fehler",
        description:
          "Bitte geben Sie einen gültigen Teamnamen und Prozentsatz (0-100) ein.",
        variant: "destructive",
      });
      return;
    }

    try {
      if (editingTeam) {
        updateTeam(editingTeam.id, formData);
        toast({
          title: "Erfolgreich",
          description: "Team wurde aktualisiert.",
        });
      } else {
        saveTeam(formData);
        toast({
          title: "Erfolgreich",
          description: "Team wurde hinzugefügt.",
        });
      }
      refreshData();
      handleCloseDialog();
    } catch (error) {
      toast({
        title: "Fehler",
        description: "Fehler beim Speichern des Teams.",
        variant: "destructive",
      });
    }
  };

  const handleDelete = (team: Team) => {
    if (
      window.confirm(`Möchten Sie das Team "${team.name}" wirklich löschen?`)
    ) {
      try {
        deleteTeam(team.id);
        toast({
          title: "Erfolgreich",
          description: "Team wurde gelöscht.",
        });
        refreshData();
      } catch (error) {
        toast({
          title: "Fehler",
          description: "Fehler beim Löschen des Teams.",
          variant: "destructive",
        });
      }
    }
  };

  const handleDuplicate = (team: Team) => {
    setFormData({
      name: `${team.name} (Kopie)`,
      overallShiftPercentage: team.overallShiftPercentage,
      teamLeaderId: team.teamLeaderId,
      ruleIds: shiftRules.reduce<Record<string, boolean>>((acc, r) => {
        acc[r.id] = team.ruleIds?.[r.id] ?? false;
        return acc;
      }, {}),
    });
    setEditingTeam(null);
    setIsDialogOpen(true);
  };

  // CSV Export
  const handleExportCSV = () => {
    try {
      const csvContent = teamsToCSV(teams);
      const filename = `teams_${new Date().toISOString().split("T")[0]}.csv`;
      downloadCSV(csvContent, filename);
      toast({
        title: "Export erfolgreich",
        description: "Teamdaten wurden als CSV exportiert.",
      });
    } catch (error) {
      toast({
        title: "Export fehlgeschlagen",
        description: "Fehler beim Exportieren der Teamdaten.",
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
        const importedTeams = csvToTeams(csvContent);

        if (importedTeams.length === 0) {
          toast({
            title: "Import fehlgeschlagen",
            description: "Keine gültigen Teamdaten in der CSV-Datei gefunden.",
            variant: "destructive",
          });
          return;
        }

        // Save imported teams
        for (const teamData of importedTeams) {
          saveTeam(teamData);
        }

        refreshData();
        toast({
          title: "Import erfolgreich",
          description: `${importedTeams.length} Teams wurden importiert.`,
        });
      } catch (error) {
        toast({
          title: "Import fehlgeschlagen",
          description:
            "Fehler beim Verarbeiten der CSV-Datei. Bitte überprüfen Sie das Format.",
          variant: "destructive",
        });
      }
    };

    reader.readAsText(file);
    event.target.value = "";
  };

  const getEmployeeName = (employeeId?: string) => {
    const emp = employees.find((e) => e.id === employeeId);
    return emp ? `${emp.firstName} ${emp.lastName}` : "—";
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
          <Button variant="outline" size="sm" onClick={handleExportCSV}>
            <Download className="w-4 h-4 mr-2" />
            Export CSV
          </Button>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => handleOpenDialog()}>
              <Plus className="w-4 h-4 mr-2" />
              Team hinzufügen
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>
                {editingTeam ? "Team bearbeiten" : "Team hinzufügen"}
              </DialogTitle>
              <DialogDescription>
                Erfassen Sie die Teamdaten und den Gesamtschichtanteil.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="name">Teamname *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, name: e.target.value }))
                  }
                  required
                />
              </div>
              <div>
                <Label htmlFor="overallShiftPercentage">
                  Gesamtschichtanteil (%) *
                </Label>
                <Input
                  id="overallShiftPercentage"
                  type="number"
                  min="0"
                  max="100"
                  value={formData.overallShiftPercentage}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      overallShiftPercentage: Number(e.target.value),
                    }))
                  }
                  required
                />
              </div>
              <div>
                <Label htmlFor="teamLeaderId">Teamleiter</Label>
                <Select
                  value={formData.teamLeaderId || "none"}
                  onValueChange={(value) =>
                    setFormData((prev) => ({
                      ...prev,
                      teamLeaderId: value === "none" ? undefined : value,
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Mitarbeiter auswählen" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Keiner</SelectItem>
                    {employees.map((emp) => (
                      <SelectItem key={emp.id} value={emp.id}>
                        {emp.firstName} {emp.lastName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Gültige Regeln</Label>
                <div className="border p-2 rounded-md max-h-40 overflow-y-auto mt-2 space-y-1">
                  {shiftRules.map(rule => (
                    <div key={rule.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={`rule-${rule.id}`}
                        checked={formData.ruleIds[rule.id] === true}
                        onCheckedChange={(checked) =>
                          setFormData(prev => ({
                            ...prev,
                            ruleIds: { ...prev.ruleIds, [rule.id]: !!checked },
                          }))
                        }
                      />
                      <Label htmlFor={`rule-${rule.id}`} className="text-sm">
                        {rule.name || rule.type}
                      </Label>
                    </div>
                  ))}
                  {shiftRules.length === 0 && (
                    <p className="text-sm text-gray-500">Keine Regeln definiert.</p>
                  )}
                </div>
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleCloseDialog}
                >
                  Abbrechen
                </Button>
                {editingTeam && (
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={() => {
                      handleDelete(editingTeam);
                      handleCloseDialog();
                    }}
                  >
                    Löschen
                  </Button>
                )}
                <Button type="submit">
                  {editingTeam ? "Aktualisieren" : "Hinzufügen"}
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
                <button type="button" onClick={() => requestSort('name')}>Name{sortConfig?.key === 'name' ? (sortConfig.direction === 'asc' ? ' ▲' : ' ▼') : ''}</button>
              </TableHead>
              <TableHead>
                <button type="button" onClick={() => requestSort('overallShiftPercentage')}>Gesamtschichtanteil (%)
                  {sortConfig?.key === 'overallShiftPercentage' ? (sortConfig.direction === 'asc' ? ' ▲' : ' ▼') : ''}</button>
              </TableHead>
              <TableHead>
                <button type="button" onClick={() => requestSort('teamLeaderId')}>Teamleiter{sortConfig?.key === 'teamLeaderId' ? (sortConfig.direction === 'asc' ? ' ▲' : ' ▼') : ''}</button>
              </TableHead>
              <TableHead className="text-right">Aktionen</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {teams.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={4}
                  className="text-center py-4 text-gray-500"
                >
                  Keine Teams gefunden.
                </TableCell>
              </TableRow>
            ) : (
              sortedTeams.map((team) => (
                <TableRow key={team.id}>
                  <TableCell className="font-medium">{team.name}</TableCell>
                  <TableCell>{team.overallShiftPercentage}%</TableCell>
                  <TableCell>{getEmployeeName(team.teamLeaderId)}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end space-x-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleOpenDialog(team)}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDuplicate(team)}
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
