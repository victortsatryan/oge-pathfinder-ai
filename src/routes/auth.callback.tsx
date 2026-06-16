import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";

import { supabase } from "@/integrations/supabase/client";

type CallbackSearch = { redirect?: string };

export const Route = createFileRoute("/auth/callback")({
  ssr: false,
  validateSearch: (search: Record<string, unknown>): CallbackSearch => ({
    redirect: typeof search.redirect === "string" ? search.redirect : undefined,
  }),
  component: AuthCallback,
});

function AuthCallback() {
  const { redirect: redirectTo } = Route.useSearch();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      try {
        // Supabase JS auto-parses tokens from the URL hash on load.
        // Also handle ?code= (PKCE / OAuth code flow) explicitly.
        const url = new URL(window.location.href);
        const code = url.searchParams.get("code");
        if (code) {
          const { error: exErr } = await supabase.auth.exchangeCodeForSession(code);
          if (exErr) throw exErr;
        }

        // Give detectSessionInUrl a tick to settle.
        const { data, error: sessErr } = await supabase.auth.getSession();
        if (sessErr) throw sessErr;
        if (!data.session) {
          // Wait one tick for onAuthStateChange triggered by hash parsing.
          await new Promise((r) => setTimeout(r, 200));
          const { data: again } = await supabase.auth.getSession();
          if (!again.session) throw new Error("no session");
        }

        if (cancelled) return;
        const target = redirectTo && redirectTo.startsWith("/") ? redirectTo : "/";
        navigate({ to: target, replace: true });
      } catch {
        if (!cancelled) {
          setError("Не удалось завершить вход. Попробуйте войти ещё раз.");
        }
      }
    }
    void run();
    return () => {
      cancelled = true;
    };
  }, [navigate, redirectTo]);

  return (
    <main
      className="min-h-screen flex items-center justify-center px-6"
      style={{ background: "var(--pf-paper)" }}
    >
      <div className="text-center space-y-3">
        {error ? (
          <>
            <p className="text-sm text-destructive">{error}</p>
            <button
              className="text-sm underline"
              onClick={() => navigate({ to: "/auth", replace: true })}
            >
              Вернуться к входу
            </button>
          </>
        ) : (
          <p className="pf-lead">Проверяем вход…</p>
        )}
      </div>
    </main>
  );
}
