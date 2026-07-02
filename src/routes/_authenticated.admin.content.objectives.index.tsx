import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { pcsListLearningObjectives } from "@/lib/pcs/pcs.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/admin/content/objectives/")({
  component: Objectives,
});

function Objectives() {
  const fn = useServerFn(pcsListLearningObjectives);
  const { data, isLoading } = useQuery({ queryKey: ["pcs-los"], queryFn: () => fn() });

  return (
    <Card>
      <CardHeader><CardTitle>Learning Objectives</CardTitle></CardHeader>
      <CardContent>
        {isLoading ? <p className="text-sm text-muted-foreground">Загрузка…</p> : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Название</TableHead>
                <TableHead>Предмет</TableHead>
                <TableHead>Тема</TableHead>
                <TableHead>Статус</TableHead>
                <TableHead>Версия</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(data?.items ?? []).map((lo: any) => (
                <TableRow key={lo.id}>
                  <TableCell>
                    <Link to="/admin/content/objectives/$loId" params={{ loId: lo.id }}
                      className="text-primary hover:underline">{lo.title}</Link>
                  </TableCell>
                  <TableCell>{lo.topic?.subject?.name ?? "—"}</TableCell>
                  <TableCell>{lo.topic?.title ?? "—"}</TableCell>
                  <TableCell><Badge variant="outline">{lo.status}</Badge></TableCell>
                  <TableCell>v{lo.version}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
