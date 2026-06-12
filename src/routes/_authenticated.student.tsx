import { createFileRoute } from "@tanstack/react-router";

import { RoleShell, type NavItem } from "@/components/oge/role-shell";

const NAV: NavItem[] = [
  { label: "Сегодня", to: "/student" },
  { label: "Мои темы", to: "/student/lessons" },
  { label: "Календарь", to: "/student/calendar" },
  { label: "Материалы", to: "/student/materials" },
  { label: "Прогресс", to: "/student/progress" },
  { label: "AI-навигатор", to: "/student/assistant" },
];

export const Route = createFileRoute("/_authenticated/student")({
  component: () => <RoleShell title="Ученик" items={NAV} accent="Ученик" />,
});
