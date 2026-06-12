import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { ExternalLink, Search } from "lucide-react";

import { PageHeader } from "@/components/oge/page-header";
import { listMaterials, listSubjectsForFilter } from "@/lib/materials.functions";

export const Route = createFileRoute("/_authenticated/student/materials")({
  component: MaterialsPage,
});

const TYPES = [
  { value: "", label: "все типы" },
  { value: "theory", label: "теория" },
  { value: "textbook_paragraph", label: "параграф" },
  { value: "video", label: "видео" },
  { value: "article", label: "статья" },
  { value: "scheme", label: "схема" },
  { value: "exercise_set", label: "упражнения" },
  { value: "test", label: "тест" },
  { value: "task_solution", label: "разбор" },
  { value: "reference", label: "справка" },
];

const TYPE_LABEL: Record<string, string> = Object.fromEntries(
  TYPES.filter((t) => t.value).map((t) => [t.value, t.label]),
);

function MaterialsPage() {
  const [subjectId, setSubjectId] = useState("");
  const [materialType, setMaterialType] = useState("");
  const [search, setSearch] = useState("");

  const fetchSubjects = useServerFn(listSubjectsForFilter);
  const fetchMaterials = useServerFn(listMaterials);

  const subjects = useQuery({
    queryKey: ["filter-subjects"],
    queryFn: () => fetchSubjects(),
  });

  const materials = useQuery({
    queryKey: ["materials", subjectId, materialType, search],
    queryFn: () =>
      fetchMaterials({
        data: {
          subject_id: subjectId || undefined,
          material_type: materialType || undefined,
          search: search || undefined,
        },
      }),
  });

  const rows = useMemo(() => materials.data?.materials ?? [], [materials.data]);

  return (
    <>
      <div className="pf-topbar">
        <div className="pf-crumb"><b>Архив</b> · материалы</div>
        <div className="pf-crumb">{rows.length} единиц</div>
      </div>

      <PageHeader
        title="Материалы"
        lead="Библиотека теории, видео, упражнений и разборов. Источник — внутренняя база и открытые материалы."
      />

      <div className="pf-block mt-6 grid gap-3 md:grid-cols-[1fr,200px,200px]">
        <div className="relative">
          <Search className="h-4 w-4 absolute left-3 top-3 text-[color:var(--pf-muted)]" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Поиск по названию"
            className="w-full pl-10 pr-3 py-2 bg-transparent border border-[color:var(--pf-divider)] text-sm focus:outline-none focus:border-[color:var(--pf-ink)]"
          />
        </div>
        <select
          value={subjectId}
          onChange={(e) => setSubjectId(e.target.value)}
          className="px-3 py-2 bg-transparent border border-[color:var(--pf-divider)] text-sm"
        >
          <option value="">все предметы</option>
          {(subjects.data?.subjects ?? []).map((s: any) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
        <select
          value={materialType}
          onChange={(e) => setMaterialType(e.target.value)}
          className="px-3 py-2 bg-transparent border border-[color:var(--pf-divider)] text-sm"
        >
          {TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
      </div>

      <div className="pf-library mt-6">
        {materials.isLoading ? (
          <p className="text-sm text-[color:var(--pf-muted)]">Загрузка…</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-[color:var(--pf-muted)]">
            По выбранным фильтрам материалов пока нет.
          </p>
        ) : (
          rows.map((m: any) => (
            <div key={m.id} className="pf-library__item">
              <div className="pf-library__kind">
                {TYPE_LABEL[m.material_type] ?? m.material_type}
                {m.subjects?.name ? ` · ${m.subjects.name}` : ""}
              </div>
              <div className="pf-library__title">
                {m.source_url ? (
                  <a href={m.source_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:underline">
                    {m.title} <ExternalLink className="h-3 w-3" />
                  </a>
                ) : (
                  m.title
                )}
              </div>
              {m.description && (
                <div className="text-xs text-[color:var(--pf-muted)] mt-1">{m.description}</div>
              )}
              <div className="flex gap-2 mt-2 flex-wrap">
                {m.source_name && <span className="pf-chip">{m.source_name}</span>}
                <span className="pf-chip">уровень {m.difficulty}</span>
                {m.estimated_time_minutes && (
                  <span className="pf-chip">{m.estimated_time_minutes} мин</span>
                )}
                {m.topic_id && m.topics?.title && (
                  <Link
                    to="/student/topics/$topicId"
                    params={{ topicId: m.topic_id }}
                    className="pf-chip hover:bg-[color:var(--pf-ink)] hover:text-[color:var(--pf-paper)]"
                  >
                    → {m.topics.title}
                  </Link>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </>
  );
}
