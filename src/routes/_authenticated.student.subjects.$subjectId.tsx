import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ChevronDown, ChevronRight } from "lucide-react";
import { useMemo, useState } from "react";

import { PageHeader } from "@/components/oge/page-header";
import {
  getSubjectTopicTree,
  listMyStudentSubjects,
} from "@/lib/student-profile.functions";

export const Route = createFileRoute("/_authenticated/student/subjects/$subjectId")({
  component: SubjectMapPage,
  errorComponent: ({ error }) => (
    <div className="p-10">Ошибка: {String((error as any)?.message ?? error)}</div>
  ),
  notFoundComponent: () => <div className="p-10">Предмет не найден</div>,
});

const STATUS_LABEL: Record<string, string> = {
  not_started: "не начато",
  weak: "слабая",
  learning: "в работе",
  stable: "стабильно",
  mastered: "освоено",
  needs_review: "на повторение",
};

const STATUS_DOT: Record<string, string> = {
  not_started: "bg-[color:var(--pf-divider)]",
  weak: "bg-[color:var(--pf-cinnabar)]",
  learning: "bg-[color:var(--pf-ochre,#d4a017)]",
  stable: "bg-[color:var(--pf-ink)]",
  mastered: "bg-[color:var(--pf-ultramarine,#2541b2)]",
  needs_review: "bg-[color:var(--pf-cinnabar)]",
};

function SubjectMapPage() {
  const { subjectId } = Route.useParams();
  const getTree = useServerFn(getSubjectTopicTree);
  const getSubjects = useServerFn(listMyStudentSubjects);

  const tree = useQuery({
    queryKey: ["subject-tree", subjectId],
    queryFn: () => getTree({ data: { subject_id: subjectId } }),
  });

  const mySubjects = useQuery({
    queryKey: ["student-subjects"],
    queryFn: () => getSubjects(),
  });

  const meta = useMemo(() => {
    const list = (mySubjects.data ?? []) as any[];
    return list.find((s) => s.subject?.id === subjectId);
  }, [mySubjects.data, subjectId]);

  return (
    <main className="min-h-screen" style={{ background: "var(--pf-paper)" }}>
      <div className="max-w-5xl mx-auto px-10 py-10">
        <div className="pf-topbar">
          <Link to="/profile" className="pf-crumb hover:text-[color:var(--pf-ink)]">
            <ArrowLeft className="h-3 w-3 inline mr-1" /> к профилю
          </Link>
          <div className="pf-crumb">
            <b>карта тем</b>
            {meta?.subject?.name ? ` · ${meta.subject.name}` : ""}
            {meta?.program?.title ? ` · ${meta.program.title}` : ""}
          </div>
        </div>

        <PageHeader
          crumb={<>предмет {meta?.subject?.exam_type ? `· ${meta.subject.exam_type}` : ""}</>}
          title={meta?.subject?.name ?? "Предмет"}
          lead={
            meta?.program?.title
              ? `Программа: ${meta.program.title}. Темы и подтемы с текущим уровнем освоения.`
              : "Свободное изучение. Список публичных тем предмета."
          }
        />

        <section className="pf-block mt-8">
          {tree.isLoading ? (
            <p className="text-sm text-[color:var(--pf-muted)]">Загрузка…</p>
          ) : (tree.data ?? []).length === 0 ? (
            <p className="text-sm text-[color:var(--pf-muted)]">
              Темы по этому предмету пока не загружены.
            </p>
          ) : (
            <ul className="grid gap-2">
              {(tree.data as any[]).map((node) => (
                <TopicNode key={node.id} node={node} depth={0} />
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}

function TopicNode({ node, depth }: { node: any; depth: number }) {
  const [open, setOpen] = useState(depth < 1);
  const hasChildren = (node.children ?? []).length > 0;
  const p = node.progress;
  const status = p?.status ?? "not_started";
  const score = p?.mastery_score ?? 0;
  return (
    <li>
      <div
        className="grid grid-cols-[24px,1fr,80px,140px] items-center gap-4 py-2 border-b border-[color:var(--pf-divider)]"
        style={{ paddingLeft: depth * 20 }}
      >
        <button
          onClick={() => setOpen((v) => !v)}
          className="text-[color:var(--pf-muted)] hover:text-[color:var(--pf-ink)]"
          aria-label={open ? "Свернуть" : "Развернуть"}
          disabled={!hasChildren}
          style={{ visibility: hasChildren ? "visible" : "hidden" }}
        >
          {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </button>
        <div className="flex items-center gap-3">
          <span className={`inline-block h-2 w-2 rounded-full ${STATUS_DOT[status] ?? STATUS_DOT.not_started}`} />
          <Link
            to="/student/topics/$topicId"
            params={{ topicId: node.id }}
            className="font-medium hover:underline"
          >
            {node.title}
          </Link>
          {node.topic_type && node.topic_type !== "topic" && (
            <span className="font-mono text-[10px] uppercase tracking-wider text-[color:var(--pf-muted)]">
              · {node.topic_type}
            </span>
          )}
        </div>
        <div className="font-mono text-[13px] text-right">{score}%</div>
        <div className="font-mono text-[11px] uppercase tracking-wider text-[color:var(--pf-muted)] text-right">
          {STATUS_LABEL[status] ?? status}
        </div>
      </div>
      {hasChildren && open && (
        <ul className="grid">
          {node.children.map((c: any) => (
            <TopicNode key={c.id} node={c} depth={depth + 1} />
          ))}
        </ul>
      )}
    </li>
  );
}
