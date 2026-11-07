import { createFileRoute } from "@tanstack/react-router";
import { PublishedMaterialsCatalog } from "@/components/oge/published-materials-catalog";

export const Route = createFileRoute("/_authenticated/admin/content/materials")({
  component: () => <PublishedMaterialsCatalog isAdmin />,
});
