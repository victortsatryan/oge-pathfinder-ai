import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { ArrowLeft, ExternalLink } from "lucide-react";

import {
  adminGetCandidate,
  adminUpdateCandidate,
} from "@/lib/community-library.functions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/_authenticated/admin/community/$id")({
  component: AdminCandidateDetail,
});

const KIND_LABEL: Record<string, string> = {
  pdf: "PDF", docx: "DOCX", image: "Изображение", video: "Видео", link: "Ссылка", text: "Текст",
};

function AdminCandidateDetail() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const fetchOne = useServerFn(adminGetCandidate);
  const updateFn = useServerFn(adminUpdateCandidate);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-candidate", id],
    queryFn: () => fetchOne({ data: { id } }),
  });

  const [notes, setNotes] = useState("");
  const [loId, setLoId] = useState("");

  useEffect(() => {
    if (data?.candidate) {
      setNotes(data.candidate.admin_notes ?? "");
      setLoId(data.candidate.learning_objective_id ?? "");
    }
  }, [data]);

  const update = useMutation({
    mutationFn: (payload: { status?: string; admin_notes?: string; learning_objective_id?: string | null }) =>
      updateFn({ data: { id, ...(payload as any) } }),
    onSuccess: (_, vars) => {
      toast.success("Обновлено");
      qc.invalidateQueries({ queryKey: ["admin-candidate", id] });
      qc.invalidateQueries({ queryKey: ["admin-candidates"] });
      if (vars.status === "rejected" || vars.status === "published") {
        navigate({ to: "/admin/community" });
      }
    },
    onError: (e: any) => toast.error(e?.message ?? "Ошибка"),
  });

  if (isLoading) return <p className="text-sm">Загрузка…</p>;
  if (!data?.candidate) return <p className="text-sm">Не найдено.</p>;

  const c = data.candidate;
  const isPublished = c.status === "published";

  return (
    <section>
      <Link to="/admin/community" className="inline-flex items-center gap-2 text-xs font-mono uppercase tracking-widest mb-6" style={{ color: "var(--pf-muted)" }}>
        <ArrowLeft className="h-3 w-3" /> к очереди
      </Link>

      <div className="grid gap-6 lg:grid-cols-[1fr,320px]">
        <div className="space-y-6">
          <div>
            <p className="pf-eyebrow mb-2">
              {KIND_LABEL[c.content_kind] ?? c.content_kind} · {c.material_type ?? "—"}
            </p>
            <h1 className="text-2xl font-medium">{c.title}</h1>
            {c.description && (
              <p className="mt-2 text-sm" style={{ color: "var(--pf-muted)" }}>{c.description}</p>
            )}
          </div>

          <InfoRow label="Автор">
            {data.author?.display_name ?? c.author_id}
          </InfoRow>
          <InfoRow label="Образовательная система / класс">
            {c.education_system ?? "—"} {c.grade ? `· ${c.grade}` : ""}
          </InfoRow>
          <InfoRow label="Предмет / тема">
            {c.subjects?.name ?? "—"} {c.topics?.title ? `· ${c.topics.title}` : ""}
          </InfoRow>
          <InfoRow label="Уровень">{c.level ?? "—"}</InfoRow>
          <InfoRow label="Что внутри">
            {Array.isArray(c.contains) && c.contains.length ? c.contains.join(", ") : "—"}
          </InfoRow>
          {c.usefulness && (
            <InfoRow label="Почему полезен (автор)">
              <span className="whitespace-pre-wrap">{c.usefulness}</span>
            </InfoRow>
          )}

          <div className="pf-block">
            <div className="pf-eyebrow mb-2">Содержимое</div>
            {c.content_kind === "text" && c.content_text && (
              <pre className="whitespace-pre-wrap text-sm">{c.content_text}</pre>
            )}
            {c.content_kind === "link" && c.link_url && (
              <a href={c.link_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm hover:underline">
                {c.link_url} <ExternalLink className="h-3 w-3" />
              </a>
            )}
            {data.signedFileUrl && (
              <a href={data.signedFileUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm hover:underline">
                Открыть файл <ExternalLink className="h-3 w-3" />
              </a>
            )}
            {!c.content_text && !c.link_url && !data.signedFileUrl && (
              <p className="text-sm" style={{ color: "var(--pf-muted)" }}>Содержимое не приложено.</p>
            )}
          </div>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-6 self-start">
          <div className="pf-block space-y-3">
            <div className="pf-eyebrow">Статус: {c.status}</div>
            {c.status === "submitted" && (
              <Button className="w-full" onClick={() => update.mutate({ status: "in_review" })}>
                Начать обработку
              </Button>
            )}
            {["submitted", "in_review"].includes(c.status) && (
              <>
                <Button className="w-full" variant="outline" onClick={() => update.mutate({ status: "approved" })}>
                  Одобрить
                </Button>
                <Button className="w-full" variant="outline" onClick={() => update.mutate({ status: "rejected" })}>
                  Отклонить
                </Button>
              </>
            )}
            {c.status === "approved" && (
              <>
                <div className="space-y-1.5">
                  <Label className="text-sm">PCS learning_objective_id</Label>
                  <Input
                    value={loId}
                    onChange={(e) => setLoId(e.target.value)}
                    placeholder="uuid или пусто"
                  />
                  <p className="text-xs" style={{ color: "var(--pf-muted)" }}>
                    Создайте PCS вручную через Studio → Импорт, затем вставьте id.
                  </p>
                </div>
                <Button
                  className="w-full"
                  onClick={() =>
                    update.mutate({
                      status: "published",
                      learning_objective_id: loId || null,
                    })
                  }
                >
                  Связать с PCS и опубликовать
                </Button>
              </>
            )}
            {isPublished && (
              <p className="text-sm" style={{ color: "var(--pf-muted)" }}>
                Опубликовано. Материал стал частью общей библиотеки.
              </p>
            )}
          </div>

          <div className="pf-block space-y-2">
            <Label className="text-sm">Заметки модератора</Label>
            <Textarea rows={4} value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={2000} />
            <Button size="sm" variant="outline" onClick={() => update.mutate({ admin_notes: notes })}>
              Сохранить заметку
            </Button>
          </div>
        </aside>
      </div>
    </section>
  );
}

function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[160px,1fr] gap-4 py-2" style={{ borderBottom: "1px solid var(--pf-line)" }}>
      <div className="text-xs font-mono uppercase tracking-widest" style={{ color: "var(--pf-muted)" }}>{label}</div>
      <div className="text-sm">{children}</div>
    </div>
  );
}
