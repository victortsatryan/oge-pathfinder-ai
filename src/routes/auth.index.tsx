import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";

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
      className="min-h-screen w-full flex items-center justify-center p-6 sm:p-12 relative"
      style={{ background: "var(--pf-paper)", color: "var(--pf-ink)" }}
    >
      {/* тонкая рамка-каре по краям экрана */}
      <div
        aria-hidden
        className="fixed inset-0 pointer-events-none m-8 opacity-30"
        style={{ border: "1px solid var(--pf-line-strong)" }}
      />

      <div
        className="w-full max-w-[440px] flex flex-col relative"
        style={{
          background: "var(--pf-paper)",
          border: "1px solid var(--pf-line-strong)",
        }}
      >
        {/* Header / Eyebrow */}
        <div
          className="p-6 flex justify-between items-baseline"
          style={{ borderBottom: "1px solid var(--pf-line-strong)" }}
        >
          <span
            className="uppercase text-[10px] font-medium"
            style={{
              fontFamily: "'IBM Plex Mono', monospace",
              letterSpacing: "0.2em",
              color: "var(--pf-muted)",
            }}
          >
            {APP_NAME} / Auth
          </span>
          <div
            className="w-2 h-2"
            style={{ background: "var(--pf-mustard)" }}
            aria-hidden
          />
        </div>

        {/* Main Content */}
        <div className="p-8 sm:p-12 space-y-10">
          {status === "sent" ? (
            <div className="space-y-8">
              <div className="space-y-4">
                <h1
                  className="text-4xl font-medium tracking-tight"
                  style={{ color: "var(--pf-ink)" }}
                >
                  Проверьте почту
                </h1>
                <p
                  className="leading-relaxed max-w-[320px]"
                  style={{ color: "var(--pf-muted)" }}
                >
                  Ссылка отправлена на <b style={{ color: "var(--pf-ink)" }}>{email}</b>.
                  Откройте письмо и перейдите по ней, чтобы войти.
                </p>
                <p className="text-xs" style={{ color: "var(--pf-muted)" }}>
                  Не забудьте проверить папку «Спам».
                </p>
              </div>

              <div className="flex items-center justify-between text-sm">
                <button
                  type="button"
                  className="underline disabled:opacity-40 disabled:no-underline"
                  disabled={cooldown > 0}
                  onClick={handleResend}
                  style={{ color: "var(--pf-ink)" }}
                >
                  {cooldown > 0 ? `Отправить ещё раз через ${cooldown}с` : "Отправить ещё раз"}
                </button>
                <button
                  type="button"
                  className="underline"
                  style={{ color: "var(--pf-muted)" }}
                  onClick={() => {
                    setStatus("idle");
                    setError(null);
                  }}
                >
                  Другой email
                </button>
              </div>

              {error ? (
                <p className="text-sm" style={{ color: "var(--pf-cinnabar)" }} role="alert">
                  {error}
                </p>
              ) : null}
            </div>
          ) : (
            <>
              <div className="space-y-4">
                <h1
                  className="text-5xl font-medium tracking-tight"
                  style={{ color: "var(--pf-ink)" }}
                >
                  Войти
                </h1>
                <p
                  className="leading-relaxed max-w-[280px]"
                  style={{ color: "var(--pf-muted)" }}
                >
                  Введите почту, чтобы получить одноразовую ссылку для входа.
                </p>
              </div>

              <form onSubmit={handleEmail} className="space-y-8">
                <div className="space-y-2">
                  <label
                    htmlFor="email"
                    className="block text-[11px] uppercase"
                    style={{
                      fontFamily: "'IBM Plex Mono', monospace",
                      letterSpacing: "0.12em",
                      color: "var(--pf-muted)",
                    }}
                  >
                    Электронная почта
                  </label>
                  <input
                    id="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@example.com"
                    className="w-full bg-transparent py-3 focus:outline-none transition-colors text-base"
                    style={{
                      borderBottom: "1px solid var(--pf-line-strong)",
                      color: "var(--pf-ink)",
                    }}
                    onFocus={(e) =>
                      (e.currentTarget.style.borderBottomColor = "var(--pf-mustard)")
                    }
                    onBlur={(e) =>
                      (e.currentTarget.style.borderBottomColor = "var(--pf-line-strong)")
                    }
                  />
                </div>

                <button
                  type="submit"
                  disabled={status === "sending"}
                  className="w-full font-medium py-4 px-6 transition-colors duration-200 flex items-center justify-center gap-3 disabled:opacity-60"
                  style={{
                    background: "var(--pf-mustard)",
                    color: "var(--pf-ink)",
                  }}
                >
                  <span>
                    {status === "sending" ? "Отправляем…" : "Получить ссылку"}
                  </span>
                  {status !== "sending" ? (
                    <svg
                      width="18"
                      height="12"
                      viewBox="0 0 18 12"
                      fill="none"
                      aria-hidden
                    >
                      <path
                        d="M12 1L17 6M17 6L12 11M17 6H1"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  ) : null}
                </button>

                {error ? (
                  <p
                    className="text-sm"
                    style={{ color: "var(--pf-cinnabar)" }}
                    role="alert"
                  >
                    {error}
                  </p>
                ) : null}
              </form>
            </>
          )}
        </div>

        {/* Footer / Legal */}
        <div
          className="mt-auto p-6"
          style={{ borderTop: "1px solid var(--pf-line-strong)" }}
        >
          <p
            className="text-[11px] leading-relaxed"
            style={{
              fontFamily: "'IBM Plex Mono', monospace",
              color: "var(--pf-muted)",
            }}
          >
            * Мы не используем пароли. Каждый вход — по одноразовой ссылке из письма.
          </p>
        </div>
      </div>
    </main>
  );
}
