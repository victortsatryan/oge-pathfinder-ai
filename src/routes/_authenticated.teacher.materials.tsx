import { createFileRoute } from "@tanstack/react-router";
import { PublishedMaterialsCatalog } from "@/components/oge/published-materials-catalog";

export const Route = createFileRoute("/_authenticated/teacher/materials")({
  component: PublishedMaterialsCatalog,
});
