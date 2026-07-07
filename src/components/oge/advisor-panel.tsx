import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { Copy } from "lucide-react";

import { buildTeacherAdvisorContext } from "@/lib/advisor.functions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";

type Props = { studentProfileId: string };

const DRAFT_TABS: { key: keyof DraftMap; label: string }[] = [
  { key: "lesson_plan", label: "План занятия" },
  { key: "homework", label: "Домашнее задание" },
  { key: "student_comment", label: "Комментарий ученику" },
  { key: "parent_report", label: "Отчёт родителю" },
];

type DraftMap = {
  lesson_plan: string;
  homework: string;
  student_comment: string;
  parent_report: string;
};

export function AdvisorPanel({ studentProfileId }: Props) {
  const fn = useServerFn(buildTeacherAdvisorContext);
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["teacher", "advisor", studentProfileId],
    queryFn: () => fn({ data: { student_profile_id: studentProfileId } }),
    retry: 1,
  });

  const [activeDraft, setActiveDraft] = useState<keyof DraftMap>("lesson_plan");
  const [draftText, setDraftText] = useState<string>("");

  const insights = (data as any)?.insights;
  const ctx = (data as any)?.context;

  useEffect(() => {
    if (insights?.drafts?.[activeDraft]) setDraftText(insights.drafts[activeDraft]);
  }, [activeDraft, insights]);

  if (isLoading) return <div className="p-4 text-sm text-muted-foreground">Загрузка советника…</div>;
  if (isError)
    return (
      <div className="p-4 text-sm text-red-600 space-y-2">
        <div>Не удалось собрать данные для советника.</div>
        <div className="text-xs">{String((error as any)?.message ?? "")}</div>
        <button className="underline" onClick={() => refetch()}>Повторить</button>
      </div>
    );

  const hasAnyData = ctx.progress_summary.total_topics > 0 || ctx.recent_lessons.length > 0 || ctx.recent_mistakes.length > 0;

  return (
    <div className="space-y-4">
      {!hasAnyData && (
        <div className="pf-block p-5 text-sm text-muted-foreground">
          Пока мало данных для устойчивых выводов. После нескольких занятий и диагностик здесь появятся наблюдения.
        </div>
      )}

      <Block title="Перед занятием">
        {insights.before_lesson.map((t: string, i: number) => (
          <p key={i} className="text-sm leading-relaxed">{t}</p>
        ))}
      </Block>

      <Block title="Что изменилось">
        {insights.changes.map((t: string, i: number) => (
          <p key={i} className="text-sm leading-relaxed">{t}</p>
        ))}
      </Block>

      <Block title="Повторяющиеся ошибки">
        {insights.repeated_mistakes.length === 0 && (
          <p className="text-sm text-muted-foreground">Повторяющиеся ошибки пока не обнаружены.</p>
        )}
        {insights.repeated_mistakes.length > 0 && (
          <>
            <ul className="text-sm space-y-1.5">
              {insights.repeated_mistakes.map((r: any) => (
                <li key={r.key} className="flex justify-between gap-3 border-b pb-1.5">
                  <span>
                    <b>{r.mistake_type ?? "без типа"}</b>
                    {r.topic_title ? ` · ${r.topic_title}` : ""}
                    {r.source ? ` · ${r.source}` : ""}
                  </span>
                  <span className="text-muted-foreground text-xs whitespace-nowrap">
                    ×{r.count}{r.last ? ` · ${new Date(r.last).toLocaleDateString()}` : ""}
                  </span>
                </li>
              ))}
            </ul>
            <p className="text-xs text-muted-foreground mt-2">
              Ошибки чаще связаны с повторяющимися пробелами, а не с новой темой.
            </p>
          </>
        )}
      </Block>

      <Block title="Возможные риски">
        <ul className="text-sm space-y-1">
          {insights.risks.map((t: string, i: number) => (
            <li key={i}>· {t}</li>
          ))}
        </ul>
      </Block>

      <Block title="Что можно использовать">
        {insights.materials_to_use.length === 0 ? (
          <p className="text-sm text-muted-foreground">Подходящих материалов по слабым темам пока не подобрано.</p>
        ) : (
          <ul className="text-sm space-y-1.5">
            {insights.materials_to_use.map((m: any) => (
              <li key={m.id} className="flex justify-between gap-3 border-b pb-1">
                <span>{m.title}</span>
                <span className="flex gap-1">
                  {m.type && <Badge variant="outline" className="text-[11px]">{m.type}</Badge>}
                  {m.difficulty ? <Badge variant="outline" className="text-[11px]">ур. {m.difficulty}</Badge> : null}
                </span>
              </li>
            ))}
          </ul>
        )}
        <p className="text-xs text-muted-foreground mt-2">
          Подборка для быстрого просмотра перед занятием: правило, задания, последние ошибки, следующий шаг маршрута.
        </p>
      </Block>

      <Block title="Быстрые черновики">
        <div className="flex flex-wrap gap-2 mb-3">
          {DRAFT_TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setActiveDraft(t.key)}
              className={`pf-chip ${activeDraft === t.key ? "is-active" : ""}`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <Textarea
          rows={12}
          value={draftText}
          onChange={(e) => setDraftText(e.target.value)}
          className="font-mono text-xs"
        />
        <div className="flex justify-end mt-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              if (typeof navigator !== "undefined" && navigator.clipboard) {
                navigator.clipboard.writeText(draftText);
              }
            }}
          >
            <Copy className="h-4 w-4 mr-1" /> Копировать
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          Это черновик. Можно редактировать, оставить как есть или заменить полностью.
        </p>
      </Block>
    </div>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="pf-block p-5 space-y-2">
      <div className="pf-eyebrow">{title}</div>
      {children}
    </section>
  );
}
