// Access-mode helper: distinguishes dev/preview builds from production.
// In dev/preview the admin area is intentionally open for testing.
// In production the admin area requires the `admin` role.

export type AccessMode = "dev-open" | "production-protected";

export function getAccessMode(): AccessMode {
  if (import.meta.env.DEV) return "dev-open";
  if (typeof window !== "undefined") {
    const h = window.location.hostname;
    // Lovable preview builds: id-preview--*.lovable.app and *-dev.lovable.app
    if (/^id-preview--/i.test(h)) return "dev-open";
    if (/-dev\.lovable\.app$/i.test(h)) return "dev-open";
  }
  return "production-protected";
}

export function isDevOpenAccess(): boolean {
  return getAccessMode() === "dev-open";
}
