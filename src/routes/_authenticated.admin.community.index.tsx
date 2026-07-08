import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";

import { adminListCandidates } from "@/lib/community-library.functions";

export const Route = createFileRoute("/_authenticated/admin/community/")({
  component: AdminCommunityQueue,
});

const STATUS_TABS = [
  { value: "all", label: "Все" },
  { value: "submitted", label: "На проверке" },
  { value: "in_review", label: "В работе" },
  { value: "approved", label: "Одобрены" },
  { value: "published", label: "Опубликованы" },
  { value: "rejected", label: "Отклонены" },
];

const STATUS_LABEL: Record<string, string> = {
  draft: "Черновик",
  submitted: "На проверке",
  in_review: "В работе",
  approved: "Одобрен",
  published: "Опубликован",
  rejected: "Отклонён",
};

function AdminCommunityQueue() {
  const [status, setStatus] = useState<string>("submitted");
  const fetchList = useServerFn(adminListCandidates);
  const { data, isLoading } = useQuery({
    queryKey: ["admin-candidates", status],
    queryFn: () => fetchList({ data: { status: status as any } }),
  });

  const rows = data?.candidates ?? [];
  const counts = data?.counts ?? {};

  return (
    <section>
      <div className="mb-6">
        <p className="pf-eyebrow mb-2">community library</p>
        <h2 className="text-2xl font-medium">Материалы пользователей</h2>
        <p className="text-sm mt-1" style={{ color: "var(--pf-muted)" }}>
          Очередь модерации. Проверьте материал и, при необходимости, свяжите с PCS.
        </p>
      </div>

      <div className="flex flex-wrap gap-4 mb-6 pb-3" style={{ borderBottom: "1px solid var(--pf-line-strong)" }}>
        {STATUS_TABS.map((t) => (
          <button
            key={t.value}
            onClick={() => setStatus(t.value)}
            className="font-mono text-[11px] uppercase tracking-widest"
            style={{
              color: status === t.value ? "var(--pf-ink)" : "var(--pf-muted)",
            }}
          >
            {t.label} {counts[t.value] != null ? `· ${counts[t.value]}` : ""}
          </button>
        ))}
      </div>

      {isLoading ? (
        <p className="text-sm" style={{ color: "var(--pf-muted)" }}>Загрузка…</p>
      ) : rows.length === 0 ? (
        <p className="text-sm" style={{ color: "var(--pf-muted)" }}>Материалов нет.</p>
      ) : (
        <ul className="grid gap-0" style={{ borderTop: "1px solid var(--pf-line-strong)" }}>
          {rows.map((r: any) => (
            <li key={r.id} style={{ borderBottom: "1px solid var(--pf-line-strong)" }}>
              <Link
                to="/admin/community/$id"
                params={{ id: r.id }}
                className="grid grid-cols-[1fr,160px,160px,120px] gap-4 items-baseline py-4 px-2 hover:bg-[color:color-mix(in_oklab,var(--pf-line)_25%,transparent)]"
              >
                <div>
                  <div className="text-[16px] font-medium">{r.title}</div>
                  <div className="text-xs mt-1" style={{ color: "var(--pf-muted)" }}>
                    {r.author?.display_name ?? r.author?.email ?? "—"}
                    {r.subjects?.name ? ` · ${r.subjects.name}` : ""}
                    {r.topics?.title ? ` · ${r.topics.title}` : ""}
                  </div>
                </div>
                <div className="text-xs" style={{ color: "var(--pf-muted)" }}>
                  {r.content_kind} · {r.material_type ?? "—"}
                </div>
                <div className="text-xs" style={{ color: "var(--pf-muted)" }}>
                  {r.submitted_at ? new Date(r.submitted_at).toLocaleDateString("ru") : new Date(r.created_at).toLocaleDateString("ru")}
                </div>
                <div className="text-xs font-mono uppercase tracking-wider">
                  {STATUS_LABEL[r.status] ?? r.status}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
