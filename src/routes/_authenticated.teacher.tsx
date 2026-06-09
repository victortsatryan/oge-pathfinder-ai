import { createFileRoute, redirect } from "@tanstack/react-router";

import { RoleShell, type NavItem } from "@/components/oge/role-shell";
import { getMyRole } from "@/lib/role.functions";

const NAV: NavItem[] = [
  { label: "Главная", to: "/teacher" },
  { label: "Ученики", to: "/teacher/students" },
  { label: "Диагностика", to: "/teacher/diagnostic" },
  { label: "Планы", to: "/teacher/plans" },
  { label: "Материалы", to: "/teacher/materials" },
  { label: "Аналитика", to: "/teacher/analytics" },
  { label: "AI", to: "/teacher/assistant" },
];

export const Route = createFileRoute("/_authenticated/teacher")({
  beforeLoad: async () => {
    const { role, onboarding_completed } = await getMyRole();
    if (!role || !onboarding_completed) throw redirect({ to: "/onboarding" });
    if (role !== "teacher") throw redirect({ to: "/student" });
  },
  component: () => <RoleShell title="Преподаватель" items={NAV} accent="Преподаватель" />,
});
