import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import type { LibraryMaterial } from "@/lib/models/schemas";
import { listQuery } from "@/lib/query/defaults";
import { communityRepo } from "@/lib/repositories/community.repository";

const TYPE_TABS: { value: string; label: string }[] = [
  { value: "all", label: "Все" },
  { value: "theory", label: "Теория" },
  { value: "task", label: "Практика" },
];

/**
 * Общая библиотека — опубликованные материалы релизной программы.
 * Один и тот же список для ученика и преподавателя.
 */
export function PublicLibraryList() {
  const [type, setType] = useState<string>("all");
  const [search, setSearch] = useState("");

  const q = useQuery(
    listQuery<LibraryMaterial>(["public-library", type, search], () =>
      communityRepo.publicMaterials({
        material_type: type,
        search: search.trim() || undefined,
      }),
    ),
  );

  const rows = q.data;

  return (
    <div className="mt-6">
      <div className="flex flex-wrap items-center gap-4 justify-between">
        <div className="flex gap-4">
          {TYPE_TABS.map((t) => (
            <button
              key={t.value}
              onClick={() => setType(t.value)}
              className="font-mono text-[11px] uppercase tracking-widest pb-1"
              style={{
                color: type === t.value ? "var(--pf-ink)" : "var(--pf-muted)",
                borderBottom:
                  type === t.value ? "2px solid var(--pf-accent, var(--pf-ink))" : "2px solid transparent",
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Поиск по названию"
          className="pf-input w-full sm:w-72 border border-[color:var(--pf-divider)] bg-transparent px-3 py-2 text-sm"
        />
      </div>

      <div className="font-mono text-[11px] uppercase tracking-widest mt-4" style={{ color: "var(--pf-muted)" }}>
        {q.isLoading ? "загрузка…" : `${rows.length} материалов`}
      </div>

      {q.isError && (
        <div className="pf-block mt-4 text-sm" style={{ color: "var(--pf-muted)" }}>
          Не удалось загрузить библиотеку. Попробуйте обновить страницу.
        </div>
      )}

      {!q.isError && !q.isLoading && rows.length === 0 && (
        <div className="pf-block mt-4 text-sm" style={{ color: "var(--pf-muted)" }}>
          По этому фильтру материалов пока нет.
        </div>
      )}

      <div className="pf-library mt-4">
        {rows.map((m) => {
          const href = m.source_url ?? m.video_url ?? null;
          return (
            <div key={m.id} className="pf-library__item">
              <div className="pf-library__kind">
                {m.material_type === "theory" ? "Теория" : m.material_type === "task" ? "Практика" : m.material_type}
                {m.subjects?.name ? ` · ${m.subjects.name}` : ""}
                {m.topics?.title ? ` · ${m.topics.title}` : ""}
              </div>
              <div className="pf-library__title">
                {href ? (
                  <a href={href} target="_blank" rel="noreferrer" className="hover:underline">
                    {m.title}
                  </a>
                ) : (
                  m.title
                )}
              </div>
              {m.description && (
                <div className="text-xs text-[color:var(--pf-muted)] mt-1 line-clamp-2">{m.description}</div>
              )}
              <div className="flex gap-2 mt-2 flex-wrap items-center">
                {m.source_name && <span className="pf-chip">{m.source_name}</span>}
                {m.difficulty != null && <span className="pf-chip">уровень {m.difficulty}</span>}
                {m.estimated_time_minutes != null && (
                  <span className="pf-chip">≈ {m.estimated_time_minutes} мин</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
