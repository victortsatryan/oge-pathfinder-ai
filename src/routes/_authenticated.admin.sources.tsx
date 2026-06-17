import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

import { listContentSources, upsertContentSource } from "@/lib/admin-materials.functions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const Route = createFileRoute("/_authenticated/admin/sources")({
  component: SourcesPage,
});

const TYPES = ["official", "open_education", "textbook", "video_platform", "practice_bank", "encyclopedia", "other"];

function SourcesPage() {
  const listFn = useServerFn(listContentSources);
  const saveFn = useServerFn(upsertContentSource);
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["content-sources"], queryFn: () => listFn() });
  const [form, setForm] = useState<any>({ title: "", base_url: "", source_type: "other", description: "", license_note: "", is_approved: false });
  const mut = useMutation({
    mutationFn: () => saveFn({ data: form }),
    onSuccess: () => { toast.success("Источник сохранён"); qc.invalidateQueries({ queryKey: ["content-sources"] }); setForm({ title: "", base_url: "", source_type: "other", description: "", license_note: "", is_approved: false }); },
    onError: (e: any) => toast.error(e?.message ?? "Ошибка"),
  });

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><CardTitle>Новый источник</CardTitle></CardHeader>
        <CardContent>
          <form className="grid gap-4 md:grid-cols-2" onSubmit={(e) => { e.preventDefault(); mut.mutate(); }}>
            <div className="space-y-1.5"><Label>Название</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required /></div>
            <div className="space-y-1.5"><Label>URL</Label><Input value={form.base_url} onChange={(e) => setForm({ ...form, base_url: e.target.value })} placeholder="https://" /></div>
            <div className="space-y-1.5">
              <Label>Тип</Label>
              <Select value={form.source_type} onValueChange={(v) => setForm({ ...form, source_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2 pt-6">
              <Checkbox id="approved" checked={form.is_approved} onCheckedChange={(c) => setForm({ ...form, is_approved: Boolean(c) })} />
              <Label htmlFor="approved">Одобрен</Label>
            </div>
            <div className="md:col-span-2 space-y-1.5"><Label>Описание</Label><Textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
            <div className="md:col-span-2 space-y-1.5"><Label>Лицензия</Label><Input value={form.license_note} onChange={(e) => setForm({ ...form, license_note: e.target.value })} /></div>
            <div className="md:col-span-2"><Button type="submit" disabled={mut.isPending}>Сохранить</Button></div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Источники</CardTitle></CardHeader>
        <CardContent>
          {q.isLoading ? <p className="text-sm text-muted-foreground">Загрузка…</p> : (
            <Table>
              <TableHeader><TableRow><TableHead>Название</TableHead><TableHead>Тип</TableHead><TableHead>URL</TableHead><TableHead>Одобрен</TableHead></TableRow></TableHeader>
              <TableBody>
                {(q.data?.sources ?? []).map((s: any) => (
                  <TableRow key={s.id}>
                    <TableCell>{s.title}</TableCell>
                    <TableCell>{s.source_type}</TableCell>
                    <TableCell className="max-w-xs truncate">{s.base_url}</TableCell>
                    <TableCell>{s.is_approved ? "✓" : "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
