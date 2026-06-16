import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { APP_NAME } from "@/lib/brand";

type AuthSearch = { redirect?: string };

export const Route = createFileRoute("/auth")({
  validateSearch: (search: Record<string, unknown>): AuthSearch => ({
    redirect: typeof search.redirect === "string" ? search.redirect : undefined,
  }),
  component: AuthPage,
});

function AuthPage() {
  const { redirect: redirectTo } = Route.useSearch();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [googleBusy, setGoogleBusy] = useState(false);

  const callbackUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/auth/callback${
          redirectTo ? `?redirect=${encodeURIComponent(redirectTo)}` : ""
        }`
      : undefined;

  async function handleEmail(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    if (!email.trim()) return;
    setStatus("sending");
    const { error: signInError } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: callbackUrl },
    });
    if (signInError) {
      setStatus("error");
      setError("Не удалось отправить ссылку. Проверьте email и попробуйте снова.");
      return;
    }
    setStatus("sent");
  }

  async function handleGoogle() {
    setError(null);
    setGoogleBusy(true);
    try {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: callbackUrl,
      });
      if (result.error) {
        setError("Не удалось войти через Google. Попробуйте ещё раз.");
        setGoogleBusy(false);
        return;
      }
      if (result.redirected) return;
      navigate({ to: redirectTo ?? "/" });
    } catch {
      setError("Не удалось войти через Google. Попробуйте ещё раз.");
      setGoogleBusy(false);
    }
  }

  return (
    <main
      className="min-h-screen flex items-center justify-center px-6 py-16"
      style={{ background: "var(--pf-paper)" }}
    >
      <div className="w-full max-w-md">
        <div className="flex items-center gap-3 mb-10">
          <span
            className="pf-rail__logo-mark"
            aria-hidden
            style={{ background: "var(--pf-cinnabar)" }}
          />
          <span className="pf-crumb">
            <b>{APP_NAME}</b>
          </span>
        </div>

        <h1 className="pf-h1 mb-3">Войти в Pathy</h1>
        <p className="pf-lead mb-8">Продолжите с почтой или Google-аккаунтом.</p>

        <div className="space-y-5">
          <Button
            type="button"
            variant="outline"
            className="w-full h-11"
            onClick={handleGoogle}
            disabled={googleBusy}
          >
            <GoogleIcon />
            <span className="ml-2">
              {googleBusy ? "Открываем Google…" : "Продолжить с Google"}
            </span>
          </Button>

          <div className="flex items-center gap-3 text-xs uppercase tracking-wide text-muted-foreground">
            <div className="h-px flex-1 bg-border" />
            или
            <div className="h-px flex-1 bg-border" />
          </div>

          {status === "sent" ? (
            <div className="rounded-md border border-border bg-muted/40 p-4 text-sm">
              Мы отправили ссылку для входа на вашу почту.
              <button
                type="button"
                className="block mt-2 text-xs underline text-muted-foreground"
                onClick={() => {
                  setStatus("idle");
                  setEmail("");
                }}
              >
                Отправить ещё раз
              </button>
            </div>
          ) : (
            <form onSubmit={handleEmail} className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                />
              </div>
              <Button type="submit" className="w-full h-11" disabled={status === "sending"}>
                {status === "sending" ? "Отправляем…" : "Получить ссылку для входа"}
              </Button>
            </form>
          )}

          {error ? (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}
        </div>
      </div>
    </main>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.64-.06-1.25-.17-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.32A9 9 0 0 0 9 18z"
      />
      <path
        fill="#FBBC05"
        d="M3.97 10.72A5.4 5.4 0 0 1 3.68 9c0-.6.1-1.18.29-1.72V4.96H.96A9 9 0 0 0 0 9c0 1.45.35 2.82.96 4.04l3.01-2.32z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.32 0 2.51.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.96l3.01 2.32C4.68 5.16 6.66 3.58 9 3.58z"
      />
    </svg>
  );
}
