import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { listMyTeacherStudents, linkStudent, updateLinkStatus, listAvailableStudents } from "@/lib/teacher.functions";
import { isDevOpenAccess } from "@/lib/admin-access";
import { PageHeader } from "@/components/oge/page-header";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/_authenticated/teacher/students/")({
  component: StudentsPage,
});

function StudentsPage() {
  const qc = useQueryClient();
  const listFn = useServerFn(listMyTeacherStudents);
  const linkFn = useServerFn(linkStudent);
  const statusFn = useServerFn(updateLinkStatus);

  const { data } = useQuery({ queryKey: ["teacher", "students"], queryFn: () => listFn() });
  const [filter, setFilter] = useState<"all" | "active" | "attention">("all");
  const [studentId, setStudentId] = useState("");
  const [err, setErr] = useState<string | null>(null);

  const linkMut = useMutation({
    mutationFn: (id: string) => linkFn({ data: { student_profile_id: id } }),
    onSuccess: () => {
      setStudentId("");
      setErr(null);
      qc.invalidateQueries({ queryKey: ["teacher", "students"] });
    },
    onError: (e: any) => setErr(e?.message ?? "Не удалось привязать ученика"),
  });

  const statusMut = useMutation({
    mutationFn: (vars: { link_id: string; status: "active" | "paused" | "archived" }) => statusFn({ data: vars }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["teacher", "students"] }),
  });

  const students = (data?.students ?? []) as any[];
  const filtered = students.filter((s) => {
    if (filter === "active") return s.status === "active";
    if (filter === "attention") return s.needs_attention;
    return true;
  });

  return (
    <>
      <div className="pf-topbar">
        <div className="pf-crumb"><b>Ученики</b> · {students.length}</div>
      </div>

      <PageHeader title="Мои ученики" lead="Привяжите ученика по ID его профиля и отслеживайте прогресс." />

      <div className="pf-block p-5 mb-6 space-y-3">
        <div className="text-sm font-medium">Привязать ученика</div>
        <div className="flex gap-2 items-end">
          <div className="flex-1 space-y-1.5">
            <Label htmlFor="sid">ID профиля ученика (student_profile_id)</Label>
            <Input id="sid" value={studentId} onChange={(e) => setStudentId(e.target.value)} placeholder="uuid…" />
          </div>
          <button
            className="pf-btn"
            disabled={!studentId || linkMut.isPending}
            onClick={() => linkMut.mutate(studentId.trim())}
          >
            Привязать
          </button>
        </div>
        {err && <div className="text-sm text-red-600">{err}</div>}
        <div className="text-xs text-muted-foreground">
          Ученик может найти ID в своём профиле и передать преподавателю.
        </div>
      </div>

      <div className="flex gap-2 mb-4 text-sm">
        {(["all", "active", "attention"] as const).map((k) => (
          <button
            key={k}
            onClick={() => setFilter(k)}
            className={`pf-chip ${filter === k ? "is-active" : ""}`}
          >
            {k === "all" ? "Все" : k === "active" ? "Активные" : "Требуют внимания"}
          </button>
        ))}
      </div>

      <div className="pf-block">
        {filtered.length === 0 && (
          <div className="p-6 text-sm text-muted-foreground">Никого по этому фильтру.</div>
        )}
        {filtered.map((s: any) => (
          <div key={s.link_id} className="pf-student-row">
            <Link
              to="/teacher/students/$studentId"
              params={{ studentId: s.student?.id ?? "" }}
              className="contents"
            >
              <span className="pf-student-row__avatar">{(s.student?.display_name ?? "У")[0]}</span>
              <div>
                <div className="pf-student-row__name">{s.student?.display_name ?? "Без имени"}</div>
                <div className="pf-student-row__sub">
                  прогресс {s.avg_mastery}% · слабых тем {s.weak_count}
                  {s.last_active && ` · посл. активность ${new Date(s.last_active).toLocaleDateString()}`}
                </div>
              </div>
            </Link>
            <div className="pf-chip">{s.needs_attention ? "внимание" : s.status}</div>
            <select
              className="text-xs border rounded px-2 py-1"
              value={s.status}
              onChange={(e) =>
                statusMut.mutate({ link_id: s.link_id, status: e.target.value as any })
              }
            >
              <option value="active">active</option>
              <option value="paused">paused</option>
              <option value="archived">archived</option>
            </select>
          </div>
        ))}
      </div>
    </>
  );
}
