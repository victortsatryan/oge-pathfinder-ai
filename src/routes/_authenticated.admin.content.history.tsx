import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { pcsListImports } from "@/lib/pcs/pcs.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/admin/content/history")({
  component: History,
});

function History() {
  const fn = useServerFn(pcsListImports);
  const { data, isLoading } = useQuery({ queryKey: ["pcs-imports"], queryFn: () => fn() });

  return (
    <Card>
      <CardHeader><CardTitle>История импортов</CardTitle></CardHeader>
      <CardContent>
        {isLoading ? <p className="text-sm text-muted-foreground">Загрузка…</p> : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Дата</TableHead>
                <TableHead>Файл</TableHead>
                <TableHead>PCS</TableHead>
                <TableHead>Статус</TableHead>
                <TableHead>Создано</TableHead>
                <TableHead>Обновлено</TableHead>
                <TableHead>Ошибок</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(data?.logs ?? []).map((l: any) => (
                <TableRow key={l.id}>
                  <TableCell>{new Date(l.imported_at).toLocaleString("ru-RU")}</TableCell>
                  <TableCell>{l.filename ?? "—"}</TableCell>
                  <TableCell>{l.pcs_version ?? "—"}</TableCell>
                  <TableCell>
                    <Badge variant={l.status === "success" ? "default" : "destructive"}>{l.status}</Badge>
                  </TableCell>
                  <TableCell>{l.rows_created}</TableCell>
                  <TableCell>{l.rows_updated}</TableCell>
                  <TableCell>{l.rows_failed}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
