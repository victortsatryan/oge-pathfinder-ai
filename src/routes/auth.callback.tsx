import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";

import { supabase } from "@/integrations/supabase/client";
import { getMyAccess } from "@/lib/role.functions";

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
        // supabase-js auto-parses the hash on load; also handle ?code= (PKCE).
        const url = new URL(window.location.href);
        const code = url.searchParams.get("code");
        if (code) {
          const { error: exErr } = await supabase.auth.exchangeCodeForSession(code);
          if (exErr) throw exErr;
        }

        // Wait for a session (up to ~2s).
        let session = (await supabase.auth.getSession()).data.session;
        for (let i = 0; !session && i < 10; i++) {
          await new Promise((r) => setTimeout(r, 200));
          session = (await supabase.auth.getSession()).data.session;
        }
        if (!session) throw new Error("no-session");

        // Verify user is real (revalidates against Auth server).
        const { data: userRes, error: userErr } = await supabase.auth.getUser();
        if (userErr || !userRes.user) throw userErr ?? new Error("no-user");

        if (cancelled) return;

        // If the callback carried an explicit safe redirect, honor it.
        if (redirectTo && redirectTo.startsWith("/") && !redirectTo.startsWith("/auth")) {
          navigate({ to: redirectTo, replace: true });
          return;
        }

        // Otherwise route by role.
        try {
          const access = await getMyAccess();
          const dest = destinationFor(access.primaryRole, access.onboardingCompleted);
          navigate({ to: dest, replace: true });
        } catch {
          // If role lookup fails, default to onboarding — user is signed in.
          navigate({ to: "/onboarding", replace: true });
        }
      } catch (e: unknown) {
        if (cancelled) return;
        const msg = (e as { message?: string })?.message ?? "";
        setError(explainError(msg));
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
      <div className="max-w-md text-center space-y-4">
        {error ? (
          <>
            <h1 className="pf-h2">Не удалось войти</h1>
            <p className="text-sm text-destructive">{error}</p>
            <button
              className="text-sm underline"
              onClick={() => navigate({ to: "/auth", replace: true })}
            >
              Вернуться ко входу
            </button>
          </>
        ) : (
          <p className="pf-lead">Проверяем вход…</p>
        )}
      </div>
    </main>
  );
}

function destinationFor(
  primaryRole: "student" | "teacher" | "admin" | null,
  onboardingCompleted: boolean,
): string {
  if (!primaryRole) return "/onboarding";
  if (primaryRole === "admin") return "/admin";
  if (primaryRole === "teacher") return "/teacher";
  if (primaryRole === "student") {
    return onboardingCompleted ? "/student" : "/onboarding";
  }
  return "/onboarding";
}

function explainError(msg: string): string {
  const m = msg.toLowerCase();
  if (m.includes("no-session") || m.includes("no-user")) {
    return "Ссылка не сработала или уже была использована. Попробуйте войти ещё раз.";
  }
  if (m.includes("expired")) return "Ссылка устарела. Запросите новую.";
  if (m.includes("network") || m.includes("fetch")) {
    return "Нет связи с сервером. Проверьте интернет и попробуйте снова.";
  }
  return "Не удалось завершить вход. Попробуйте отправить ссылку ещё раз.";
}
