import { createFileRoute, redirect } from "@tanstack/react-router";

import { RoleShell, type NavItem } from "@/components/oge/role-shell";
import { getMyRole } from "@/lib/role.functions";

const NAV: NavItem[] = [
  { label: "Главная", to: "/student" },
  { label: "Диагностика", to: "/student/diagnostic" },
  { label: "Календарь", to: "/student/calendar" },
  { label: "Занятия", to: "/student/lessons" },
  { label: "Материалы", to: "/student/materials" },
  { label: "Прогресс", to: "/student/progress" },
  { label: "AI", to: "/student/assistant" },
];

export const Route = createFileRoute("/_authenticated/student")({
  beforeLoad: async () => {
    const { role, onboarding_completed } = await getMyRole();
    if (!role || !onboarding_completed) throw redirect({ to: "/onboarding" });
    if (role !== "student") throw redirect({ to: "/teacher" });
  },
  component: () => <RoleShell title="Ученик" items={NAV} accent="Ученик" />,
});
