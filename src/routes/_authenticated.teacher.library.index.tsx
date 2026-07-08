import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";

import { PageHeader } from "@/components/oge/page-header";
import {
  listMyCandidates,
  deleteMyCandidate,
} from "@/lib/community-library.functions";

export const Route = createFileRoute("/_authenticated/teacher/library/")({
  component: LibraryHome,
});

const STATUS_LABEL: Record<string, string> = {
  draft: "Черновик",
  submitted: "На проверке",
  in_review: "Проверяется",
  approved: "Одобрен",
  published: "Опубликован",
  rejected: "Отклонён",
};

const KIND_LABEL: Record<string, string> = {
  pdf: "PDF",
  docx: "DOCX",
  image: "Изображение",
  video: "Видео",
  link: "Ссылка",
  text: "Текст",
};

function LibraryHome() {
  const [tab, setTab] = useState<"mine" | "public">("mine");
  const fetchMine = useServerFn(listMyCandidates);
  const removeFn = useServerFn(deleteMyCandidate);
  const qc = useQueryClient();

  const mine = useQuery({
    queryKey: ["my-candidates"],
    queryFn: () => fetchMine(),
    enabled: tab === "mine",
  });

  const del = useMutation({
    mutationFn: (id: string) => removeFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Удалено");
      qc.invalidateQueries({ queryKey: ["my-candidates"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Ошибка удаления"),
  });

  const rows = mine.data?.candidates ?? [];

  return (
    <>
      <div className="pf-topbar">
        <div className="pf-crumb"><b>Библиотека</b> · community</div>
        <div className="pf-crumb">{tab === "mine" ? `${rows.length} материалов` : "скоро"}</div>
      </div>

      <PageHeader
        title="Библиотека"
        lead="Общая база материалов Pathy. Предлагайте свои материалы — они сразу доступны вам и попадают в очередь модерации."
      />

      <div className="mt-6 flex items-center justify-between gap-4">
        <div className="flex gap-6">
          <button
            onClick={() => setTab("mine")}
            className="font-mono text-[11px] uppercase tracking-widest pb-2"
            style={{
              color: tab === "mine" ? "var(--pf-ink)" : "var(--pf-muted)",
              borderBottom: tab === "mine" ? "2px solid var(--pf-ink)" : "2px solid transparent",
            }}
          >
            Мои материалы
          </button>
          <button
            onClick={() => setTab("public")}
            className="font-mono text-[11px] uppercase tracking-widest pb-2"
            style={{
              color: tab === "public" ? "var(--pf-ink)" : "var(--pf-muted)",
              borderBottom: tab === "public" ? "2px solid var(--pf-ink)" : "2px solid transparent",
            }}
          >
            Общая библиотека
          </button>
        </div>
        <Link to="/teacher/library/new" className="pf-btn pf-btn--primary inline-flex items-center gap-2">
          <Plus className="h-4 w-4" /> Предложить материал
        </Link>
      </div>

      {tab === "public" && (
        <div className="pf-block mt-6 text-sm" style={{ color: "var(--pf-muted)" }}>
          Общая библиотека соберётся из одобренных материалов. Раздел скоро откроется.
        </div>
      )}

      {tab === "mine" && (
        <div className="pf-library mt-6">
          {mine.isLoading ? (
            <p className="text-sm text-[color:var(--pf-muted)]">Загрузка…</p>
          ) : rows.length === 0 ? (
            <div className="pf-block text-sm" style={{ color: "var(--pf-muted)" }}>
              У вас пока нет материалов. Нажмите «Предложить материал», чтобы добавить первый.
            </div>
          ) : (
            rows.map((c: any) => (
              <div key={c.id} className="pf-library__item">
                <div className="pf-library__kind">
                  {KIND_LABEL[c.content_kind] ?? c.content_kind}
                  {c.subjects?.name ? ` · ${c.subjects.name}` : ""}
                  {c.topics?.title ? ` · ${c.topics.title}` : ""}
                </div>
                <div className="pf-library__title">
                  {c.status === "draft" ? (
                    <Link
                      to="/teacher/library/new"
                      search={{ id: c.id }}
                      className="hover:underline"
                    >
                      {c.title}
                    </Link>
                  ) : (
                    c.title
                  )}
                </div>
                {c.description && (
                  <div className="text-xs text-[color:var(--pf-muted)] mt-1">{c.description}</div>
                )}
                <div className="flex gap-2 mt-2 flex-wrap items-center">
                  <span className="pf-chip">{STATUS_LABEL[c.status] ?? c.status}</span>
                  {c.material_type && <span className="pf-chip">{c.material_type}</span>}
                  {c.status === "draft" && (
                    <button
                      onClick={() => {
                        if (confirm("Удалить черновик?")) del.mutate(c.id);
                      }}
                      className="ml-auto inline-flex items-center gap-1 text-xs text-[color:var(--pf-muted)] hover:text-[color:var(--pf-ink)]"
                    >
                      <Trash2 className="h-3 w-3" /> удалить
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </>
  );
}
