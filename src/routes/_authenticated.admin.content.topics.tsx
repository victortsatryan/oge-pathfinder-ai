import { createFileRoute } from "@tanstack/react-router";
import { TopicCatalogEditor } from "@/components/oge/topic-catalog-editor";

export const Route = createFileRoute("/_authenticated/admin/content/topics")({
  component: TopicCatalogEditor,
});
