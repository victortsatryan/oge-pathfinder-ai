import { createFileRoute, redirect } from "@tanstack/react-router";

// Legacy URL: one import interface for PCS, CSV, JSON and PDF Extractor data.
export const Route = createFileRoute("/_authenticated/admin/content/extractor")({
  beforeLoad: () => { throw redirect({ to: "/admin/import" }); },
});
