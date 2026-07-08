import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { APP_NAME } from "@/lib/brand";

type AuthSearch = { redirect?: string };

export const Route = createFileRoute("/auth/")({
  validateSearch: (search: Record<string, unknown>): AuthSearch => ({
    redirect: typeof search.redirect === "string" ? search.redirect : undefined,
  }),
  component: AuthPage,
});

const RESEND_COOLDOWN_SEC = 60;

function AuthPage() {
  const { redirect: redirectTo } = Route.useSearch();
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const callbackUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/auth/callback${
          redirectTo ? `?redirect=${encodeURIComponent(redirectTo)}` : ""
        }`
      : undefined;

  function validateEmail(value: string) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  }

  async function sendLink(targetEmail: string) {
    setError(null);
    setStatus("sending");
    const { error: signInError } = await supabase.auth.signInWithOtp({
      email: targetEmail,
      options: { emailRedirectTo: callbackUrl },
    });
    if (signInError) {
      setStatus("error");
      const msg = signInError.message?.toLowerCase() ?? "";
      if (msg.includes("rate") || msg.includes("limit")) {
        setError("Слишком часто. Подождите минуту и попробуйте снова.");
      } else if (msg.includes("invalid") && msg.includes("email")) {
        setError("Проверьте адрес — похоже, он введён с ошибкой.");
      } else {
        setError("Не удалось отправить письмо. Попробуйте ещё раз через минуту.");
      }
      return;
    }
    setStatus("sent");
    setCooldown(RESEND_COOLDOWN_SEC);
  }

  async function handleEmail(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = email.trim();
    if (!trimmed) return;
    if (!validateEmail(trimmed)) {
      setStatus("error");
      setError("Введите корректный email.");
      return;
    }
    await sendLink(trimmed);
  }

  async function handleResend() {
    if (cooldown > 0 || !email.trim()) return;
    await sendLink(email.trim());
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
        <p className="pf-lead mb-8">
          Введите почту — мы отправим ссылку для входа.
        </p>

        {status === "sent" ? (
          <div className="space-y-4">
            <div className="rounded-md border border-border bg-muted/40 p-4 text-sm leading-relaxed">
              Мы отправили ссылку на <b>{email}</b>. Откройте письмо и
              перейдите по ссылке, чтобы войти.
              <div className="mt-1 text-xs text-muted-foreground">
                Не забудьте проверить папку «Спам».
              </div>
            </div>
            <div className="flex items-center justify-between text-sm">
              <button
                type="button"
                className="underline disabled:opacity-40 disabled:no-underline"
                disabled={cooldown > 0}
                onClick={handleResend}
              >
                {cooldown > 0 ? `Отправить ещё раз через ${cooldown}с` : "Отправить ещё раз"}
              </button>
              <button
                type="button"
                className="text-muted-foreground underline"
                onClick={() => {
                  setStatus("idle");
                  setError(null);
                }}
              >
                Другой email
              </button>
            </div>
            {error ? (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            ) : null}
          </div>
        ) : (
          <form onSubmit={handleEmail} className="space-y-4">
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
            <Button
              type="submit"
              className="w-full h-11"
              disabled={status === "sending"}
            >
              {status === "sending" ? "Отправляем…" : "Получить ссылку для входа"}
            </Button>
            {error ? (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            ) : null}
            <p className="text-xs text-muted-foreground">
              Мы не используем пароли. Каждый вход — по одноразовой ссылке из
              письма.
            </p>
          </form>
        )}
      </div>
    </main>
  );
}
