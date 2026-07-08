import { type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { Button } from "@/components/ui/button";
import { isDevOpenAccess } from "@/lib/admin-access";
import { getMyAccess, type UserRole } from "@/lib/role.functions";

type Props = {
  required: UserRole;
  children: ReactNode;
};

// Enforces role-based access in production. In dev/preview it is intentionally
// open so contributors can test any role without an admin grant.
export function RoleGate({ required, children }: Props) {
  const devOpen = isDevOpenAccess();
  const fetchAccess = useServerFn(getMyAccess);
  const q = useQuery({
    queryKey: ["my-access"],
    queryFn: () => fetchAccess(),
    // Even in dev-open we still fetch so headers/user info can be surfaced,
    // but we don't block on failures.
    retry: 0,
    staleTime: 30_000,
  });

  if (devOpen) return <>{children}</>;

  if (q.isLoading) {
    return <div className="p-8 text-sm text-muted-foreground">Проверяем доступ…</div>;
  }

  if (q.isError || !q.data) {
    return (
      <ErrorScreen
        title="Не удалось проверить доступ"
        message="Попробуйте перезагрузить страницу или войти заново."
        primary={{ label: "Войти заново", to: "/auth" }}
      />
    );
  }

  const { primaryRole, roles } = q.data;

  if (!primaryRole) {
    return (
      <ErrorScreen
        title="Нужно завершить регистрацию"
        message="У вашего аккаунта пока нет роли. Пройдите короткий онбординг."
        primary={{ label: "К онбордингу", to: "/onboarding" }}
      />
    );
  }

  const allowed = roles.includes(required);
  if (!allowed) {
    return (
      <ErrorScreen
        title="403 · Доступ запрещён"
        message={`Раздел доступен только пользователям с ролью «${required}».`}
        primary={{ label: "На главную", to: "/" }}
      />
    );
  }

  return <>{children}</>;
}

function ErrorScreen({
  title,
  message,
  primary,
}: {
  title: string;
  message: string;
  primary: { label: string; to: string };
}) {
  return (
    <div className="container max-w-2xl py-16 text-center space-y-3">
      <h1 className="text-3xl font-semibold">{title}</h1>
      <p className="text-sm text-muted-foreground">{message}</p>
      <div className="pt-2">
        <Button asChild variant="outline" size="sm">
          <Link to={primary.to as any}>{primary.label}</Link>
        </Button>
      </div>
    </div>
  );
}
