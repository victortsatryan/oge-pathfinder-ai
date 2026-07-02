import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { pcsProgramTree } from "@/lib/pcs/pcs.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronRight } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/content/programs")({
  component: Programs,
});

function Programs() {
  const fn = useServerFn(pcsProgramTree);
  const { data, isLoading } = useQuery({ queryKey: ["pcs-tree"], queryFn: () => fn() });

  if (isLoading) return <div className="text-sm text-muted-foreground">Загрузка…</div>;
  const subjects = data?.subjects ?? [];
  const topics = data?.topics ?? [];
  const los = data?.learning_objectives ?? [];

  function childrenOf(parentId: string | null) {
    return topics.filter((t: any) => t.parent_topic_id === parentId);
  }

  const renderTopic = (t: any, depth: number): any => {
    const kids = topics.filter((x: any) => x.parent_topic_id === t.id);
    const loList = los.filter((l: any) => l.topic_id === t.id);
    return (
      <Collapsible key={t.id} defaultOpen={depth < 1}>
        <CollapsibleTrigger className="flex items-center gap-2 py-1 text-sm hover:underline w-full text-left">
          <ChevronRight className="h-3 w-3" />
          <span className="text-xs text-muted-foreground">[{t.topic_type}]</span>
          <span>{t.title}</span>
        </CollapsibleTrigger>
        <CollapsibleContent className="pl-6 border-l ml-2">
          {kids.map((k: any) => renderTopic(k, depth + 1))}
          {loList.map((lo: any) => (
            <Link key={lo.id} to="/admin/content/objectives/$loId" params={{ loId: lo.id }}
              className="block py-1 text-sm text-primary hover:underline">
              📘 {lo.title} <span className="text-xs text-muted-foreground">({lo.status} v{lo.version})</span>
            </Link>
          ))}
        </CollapsibleContent>
      </Collapsible>
    );
  };

  return (
    <Card>
      <CardHeader><CardTitle>Программы</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        {subjects.length === 0 && <p className="text-sm text-muted-foreground">Пусто. Импортируйте контент.</p>}
        {subjects.map((s: any) => {
          const rootTopics = topics.filter((t: any) => t.subject_id === s.id && !t.parent_topic_id);
          return (
            <Collapsible key={s.id} defaultOpen>
              <CollapsibleTrigger className="flex items-center gap-2 font-medium">
                <ChevronRight className="h-4 w-4" /> {s.name}
              </CollapsibleTrigger>
              <CollapsibleContent className="pl-4 border-l ml-2 mt-2">
                {rootTopics.map((t: any) => renderTopic(t, 0))}
              </CollapsibleContent>
            </Collapsible>
          );
        })}
      </CardContent>
    </Card>
  );
}
