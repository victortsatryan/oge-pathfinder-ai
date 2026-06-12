import { createFileRoute } from "@tanstack/react-router";

import { RoleShell, type NavItem } from "@/components/oge/role-shell";

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
  component: () => <RoleShell title="Ученик" items={NAV} accent="Ученик" />,
});
