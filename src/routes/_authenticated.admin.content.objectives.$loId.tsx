import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { pcsGetLearningObjective } from "@/lib/pcs/pcs.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/admin/content/objectives/$loId")({
  component: LoCard,
});

function LoCard() {
  const { loId } = Route.useParams();
  const fn = useServerFn(pcsGetLearningObjective);
  const { data, isLoading } = useQuery({
    queryKey: ["pcs-lo", loId],
    queryFn: () => fn({ data: { id: loId } }),
  });

  if (isLoading) return <div className="text-sm text-muted-foreground">Загрузка…</div>;
  if (!data) return <div className="text-sm">Не найдено</div>;
  const { lo, examples, patterns, sources, diagnostic } = data;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <CardTitle>{lo.title}</CardTitle>
            <Badge variant="outline">{lo.status}</Badge>
            <Badge variant="secondary">v{lo.version}</Badge>
          </div>
          {lo.pcs_key && <p className="text-xs text-muted-foreground">{lo.pcs_key} · PCS {lo.pcs_version}</p>}
        </CardHeader>
        <CardContent className="space-y-4">
          {lo.description && <p className="text-sm">{lo.description}</p>}
          {lo.theory && (
            <section>
              <h3 className="font-medium mb-1">Теория</h3>
              <pre className="whitespace-pre-wrap text-sm bg-muted rounded p-3">{lo.theory}</pre>
            </section>
          )}
          {lo.algorithm && (
            <section>
              <h3 className="font-medium mb-1">Алгоритм</h3>
              <pre className="whitespace-pre-wrap text-sm bg-muted rounded p-3">{lo.algorithm}</pre>
            </section>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Примеры ({examples.length})</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {examples.length === 0 && <p className="text-sm text-muted-foreground">Нет примеров</p>}
          {examples.map((e: any) => (
            <div key={e.id} className="border rounded p-3 text-sm">
              {e.title && <div className="font-medium mb-1">{e.title}</div>}
              <div><b>Условие:</b> {e.statement}</div>
              {e.solution && <div className="mt-1"><b>Решение:</b> {e.solution}</div>}
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Task Patterns ({patterns.length})</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {patterns.length === 0 && <p className="text-sm text-muted-foreground">Нет шаблонов</p>}
          {patterns.map((p: any) => (
            <div key={p.id} className="border rounded p-3 text-sm space-y-1">
              {p.pattern_key && <div className="text-xs text-muted-foreground">{p.pattern_key}</div>}
              <div><b>Шаблон:</b> {p.statement_template}</div>
              <div className="text-xs">Сложность: {p.difficulty}</div>
              {p.answer_schema && (
                <details><summary className="text-xs cursor-pointer">answer_schema</summary>
                  <pre className="text-xs bg-muted p-2 rounded">{JSON.stringify(p.answer_schema, null, 2)}</pre>
                </details>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Источники ({sources.length})</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {sources.length === 0 && <p className="text-sm text-muted-foreground">Нет источников</p>}
          {sources.map((s: any) => (
            <div key={s.id} className="text-sm">
              • <b>{s.name}</b>{s.url && (<> — <a href={s.url} target="_blank" rel="noreferrer" className="text-primary underline">{s.url}</a></>)}
              {s.citation && <div className="text-xs text-muted-foreground pl-3">{s.citation}</div>}
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Диагностика</CardTitle></CardHeader>
        <CardContent className="text-sm">
          {diagnostic ? (
            <div className="space-y-1">
              <div>Минимум заданий: <b>{diagnostic.min_tasks}</b></div>
              <div>Порог освоения: <b>{diagnostic.mastery_threshold}%</b></div>
              {diagnostic.difficulty_curve && (
                <pre className="text-xs bg-muted p-2 rounded">{JSON.stringify(diagnostic.difficulty_curve, null, 2)}</pre>
              )}
            </div>
          ) : <p className="text-muted-foreground">Не настроена</p>}
        </CardContent>
      </Card>
    </div>
  );
}
