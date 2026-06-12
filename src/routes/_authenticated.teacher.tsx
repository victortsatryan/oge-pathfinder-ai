import { createFileRoute } from "@tanstack/react-router";

import { RoleShell, type NavItem } from "@/components/oge/role-shell";

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
  component: () => <RoleShell title="Преподаватель" items={NAV} accent="Преподаватель" />,
});
