import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, BookOpen, Video, FileText, ListChecks, Sparkles, ExternalLink } from "lucide-react";

import { PageHeader } from "@/components/oge/page-header";
import {
  getTopicOverview,
  getRecommendedMaterials,
} from "@/lib/materials.functions";

export const Route = createFileRoute("/_authenticated/student/topics/$topicId")({
  component: TopicPage,
  errorComponent: ({ error }) => (
    <div className="p-10">Ошибка: {String((error as any)?.message ?? error)}</div>
  ),
});

const TYPE_ICON: Record<string, any> = {
  theory: BookOpen,
  textbook_paragraph: BookOpen,
  video: Video,
  article: FileText,
  scheme: FileText,
  infographic: FileText,
  exercise_set: ListChecks,
  test: ListChecks,
  task_solution: FileText,
  reference: FileText,
};

const TYPE_LABEL: Record<string, string> = {
  theory: "теория",
  textbook_paragraph: "параграф",
  video: "видео",
  article: "статья",
  scheme: "схема",
  infographic: "инфографика",
  exercise_set: "упражнения",
  test: "тест",
  task_solution: "разбор",
  reference: "справка",
};

function TopicPage() {
  const { topicId } = Route.useParams();
  const fetchOverview = useServerFn(getTopicOverview);
  const fetchRecommended = useServerFn(getRecommendedMaterials);

  const overview = useQuery({
    queryKey: ["topic-overview", topicId],
    queryFn: () => fetchOverview({ data: { topic_id: topicId } }),
  });

  const recommended = useQuery({
    queryKey: ["topic-recommended", topicId],
    queryFn: () => fetchRecommended({ data: { topic_id: topicId } }),
  });

  const topic = overview.data?.topic as any;
  const materials = overview.data?.materials ?? [];
  const tasks = overview.data?.tasks ?? [];
  const tests = overview.data?.tests ?? [];

  const grouped = materials.reduce<Record<string, any[]>>((acc, m: any) => {
    (acc[m.material_type] ??= []).push(m);
    return acc;
  }, {});

  return (
    <main className="min-h-screen" style={{ background: "var(--pf-paper)" }}>
      <div className="max-w-5xl mx-auto px-10 py-10">
        <div className="pf-topbar">
          {topic?.subject_id ? (
            <Link
              to="/student/subjects/$subjectId"
              params={{ subjectId: topic.subject_id }}
              className="pf-crumb hover:text-[color:var(--pf-ink)]"
            >
              <ArrowLeft className="h-3 w-3 inline mr-1" /> к карте предмета
            </Link>
          ) : (
            <span className="pf-crumb">тема</span>
          )}
          <div className="pf-crumb">
            <b>тема</b>{topic?.subjects?.name ? ` · ${topic.subjects.name}` : ""}
          </div>
        </div>

        <PageHeader
          crumb={<>учебный модуль</>}
          title={topic?.title ?? "Тема"}
          lead={topic?.description ?? "Материалы, упражнения и тесты по теме."}
        />

        {/* Recommended */}
        <section className="pf-block mt-8">
          <h2 className="pf-h2 flex items-center gap-2">
            <Sparkles className="h-4 w-4" /> Рекомендовано для вас
          </h2>
          {recommended.isLoading ? (
            <p className="text-sm text-[color:var(--pf-muted)] mt-2">Подбираем…</p>
          ) : (recommended.data?.materials ?? []).length === 0 ? (
            <p className="text-sm text-[color:var(--pf-muted)] mt-2">
              Подходящие материалы пока не загружены. Текущий уровень: {recommended.data?.mastery ?? 0}%.
            </p>
          ) : (
            <>
              <p className="text-xs text-[color:var(--pf-muted)] font-mono mt-2 mb-3">
                уровень {recommended.data?.mastery}% · стратегия:{" "}
                {recommended.data?.strategy.preferredTypes.map((t) => TYPE_LABEL[t] ?? t).join(" · ")}
              </p>
              <div className="grid gap-2">
                {recommended.data!.materials.map((m: any) => (
                  <MaterialRow key={m.id} m={m} />
                ))}
              </div>
            </>
          )}
        </section>

        {/* Materials by type */}
        {Object.entries(grouped).map(([type, items]) => (
          <section key={type} className="pf-block mt-6">
            <h2 className="pf-h2">{TYPE_LABEL[type] ?? type}</h2>
            <div className="grid gap-2 mt-3">
              {items.map((m: any) => (
                <MaterialRow key={m.id} m={m} />
              ))}
            </div>
          </section>
        ))}

        {/* Tasks */}
        {tasks.length > 0 && (
          <section className="pf-block mt-6">
            <h2 className="pf-h2">Задания</h2>
            <ul className="grid gap-2 mt-3">
              {tasks.map((t: any) => (
                <li key={t.id} className="py-2 border-b border-[color:var(--pf-divider)]">
                  <div className="text-sm">{t.title ?? t.prompt}</div>
                  <div className="font-mono text-[11px] uppercase tracking-wider text-[color:var(--pf-muted)] mt-1">
                    {t.task_type ?? "задание"} · {t.difficulty}
                    {t.source_name ? ` · ${t.source_name}` : ""}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Tests */}
        {tests.length > 0 && (
          <section className="pf-block mt-6">
            <h2 className="pf-h2">Тесты</h2>
            <ul className="grid gap-2 mt-3">
              {tests.map((t: any) => (
                <li key={t.id} className="py-2 border-b border-[color:var(--pf-divider)]">
                  <div className="text-sm font-medium">{t.title}</div>
                  <div className="font-mono text-[11px] uppercase tracking-wider text-[color:var(--pf-muted)] mt-1">
                    {t.test_type}{t.duration_minutes ? ` · ${t.duration_minutes} мин` : ""}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}

        {materials.length === 0 && tasks.length === 0 && tests.length === 0 && !overview.isLoading && (
          <p className="text-sm text-[color:var(--pf-muted)] mt-6">
            По теме пока нет материалов. Они появятся по мере наполнения библиотеки.
          </p>
        )}
      </div>
    </main>
  );
}

function MaterialRow({ m }: { m: any }) {
  const Icon = TYPE_ICON[m.material_type] ?? FileText;
  return (
    <div className="grid grid-cols-[20px,1fr,auto] items-start gap-3 py-2 border-b border-[color:var(--pf-divider)]">
      <Icon className="h-4 w-4 mt-1 text-[color:var(--pf-muted)]" />
      <div>
        <div className="text-sm font-medium">
          {m.source_url ? (
            <a href={m.source_url} target="_blank" rel="noreferrer" className="hover:underline inline-flex items-center gap-1">
              {m.title} <ExternalLink className="h-3 w-3" />
            </a>
          ) : (
            m.title
          )}
        </div>
        {m.description && (
          <div className="text-xs text-[color:var(--pf-muted)] mt-0.5">{m.description}</div>
        )}
        <div className="font-mono text-[11px] uppercase tracking-wider text-[color:var(--pf-muted)] mt-1">
          {TYPE_LABEL[m.material_type] ?? m.material_type}
          {m.source_name ? ` · ${m.source_name}` : ""}
          {m.estimated_time_minutes ? ` · ${m.estimated_time_minutes} мин` : ""}
        </div>
      </div>
      <div className="font-mono text-[11px] text-[color:var(--pf-muted)] whitespace-nowrap">
        ур. {m.difficulty}
      </div>
    </div>
  );
}
