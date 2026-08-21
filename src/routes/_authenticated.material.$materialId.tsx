import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, ExternalLink } from "lucide-react";

import { getMaterialDetail } from "@/lib/materials.functions";

export const Route = createFileRoute("/_authenticated/material/$materialId")({
  component: MaterialPage,
  errorComponent: ({ error }) => (
    <div className="pf-reader py-16 text-sm" style={{ color: "var(--pf-cinnabar)" }}>
      Ошибка: {String((error as Error)?.message ?? error)}
    </div>
  ),
});

const TYPE_LABEL: Record<string, string> = {
  theory: "Теория",
  task: "Практика",
  video: "Видео",
  scheme: "Схема",
  reference: "Справочник",
  exercise_set: "Набор упражнений",
};

function MaterialPage() {
  const { materialId } = Route.useParams();
  const router = useRouter();
  const fetchMaterial = useServerFn(getMaterialDetail);

  const q = useQuery({
    queryKey: ["material", materialId],
    queryFn: () => fetchMaterial({ data: { material_id: materialId } }),
  });

  const m = q.data?.material as Record<string, any> | null | undefined;

  return (
    <article className="pf-reader pf-rise">
      <div className="pf-section-eyebrow">
        <button
          type="button"
          onClick={() => router.history.back()}
          className="pf-section-eyebrow__label inline-flex items-center gap-2 hover:text-[color:var(--pf-ink)]"
        >
          <ArrowLeft className="h-3 w-3" /> <b>Назад</b>
        </button>
        <span className="pf-section-eyebrow__label">
          {m?.topics?.title ?? m?.subjects?.name ?? ""}
        </span>
      </div>

      {q.isLoading ? (
        <p className="pf-eyebrow py-16">загрузка…</p>
      ) : !m ? (
        <div className="pf-block mt-8 text-sm" style={{ color: "var(--pf-muted)" }}>
          Материал не найден или недоступен.
        </div>
      ) : (
        <>
          <header className="mb-10">
            <p className="pf-eyebrow mb-4">
              {TYPE_LABEL[m.material_type] ?? m.material_type}
              {m.subjects?.name ? ` · ${m.subjects.name}` : ""}
              {m.topics?.title ? ` · ${m.topics.title}` : ""}
            </p>
            <h1 className="pf-h1 break-words">{m.title}</h1>
            {m.description && <p className="pf-lead">{m.description}</p>}
            <div className="flex flex-wrap gap-2 mt-4">
              {m.difficulty != null && <span className="pf-chip">уровень {m.difficulty}</span>}
              {m.estimated_time_minutes != null && (
                <span className="pf-chip">≈ {m.estimated_time_minutes} мин</span>
              )}
            </div>
          </header>

          {m.content_text ? (
            <div
              className="text-[15px] leading-relaxed whitespace-pre-wrap break-words"
              style={{ color: "var(--pf-ink)" }}
            >
              {m.content_text}
            </div>
          ) : (
            <p className="text-sm" style={{ color: "var(--pf-muted)" }}>
              Текст материала пока не загружен в Pathy.
            </p>
          )}

          {m.video_url && (
            <div className="mt-8">
              <a
                href={m.video_url}
                target="_blank"
                rel="noreferrer"
                className="pf-btn pf-btn--ghost inline-flex items-center gap-2"
              >
                Смотреть видео <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          )}

          {(m.source_name || m.source_url) && (
            <footer
              className="mt-12 pt-6 flex flex-wrap items-center gap-4 justify-between"
              style={{ borderTop: "1px solid var(--pf-line)" }}
            >
              <span
                className="font-mono text-[11px] uppercase tracking-widest"
                style={{ color: "var(--pf-muted)" }}
              >
                Источник: {m.source_name ?? "внешний"}
              </span>
              {m.source_url && (
                <a
                  href={m.source_url}
                  target="_blank"
                  rel="noreferrer"
                  className="pf-btn pf-btn--ghost inline-flex items-center gap-2"
                >
                  Открыть источник <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </footer>
          )}
        </>
      )}
    </article>
  );
}
