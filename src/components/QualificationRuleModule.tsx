'use client';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LearningYearManagement } from './LearningYearManagement';
import { ShiftRuleManagement } from './ShiftRuleManagement';

export function QualificationRuleModule() {
  return (
    <Tabs defaultValue="learning" className="space-y-4">
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="learning">Lehrjahre</TabsTrigger>
        <TabsTrigger value="rules">Schichtregeln</TabsTrigger>
      </TabsList>
      <TabsContent value="learning">
        <Card>
          <CardHeader>
            <CardTitle>Lehrjahr-Qualifikationen</CardTitle>
          </CardHeader>
          <CardContent>
            <LearningYearManagement />
          </CardContent>
        </Card>
      </TabsContent>
      <TabsContent value="rules">
        <Card>
          <CardHeader>
            <CardTitle>Schichtregeln</CardTitle>
          </CardHeader>
          <CardContent>
            <ShiftRuleManagement />
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}
