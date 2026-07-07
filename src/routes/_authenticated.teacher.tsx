import { createFileRoute } from "@tanstack/react-router";

import { RoleShell, type NavItem } from "@/components/oge/role-shell";

const NAV: NavItem[] = [
  { label: "Главная", to: "/teacher" },
  { label: "Ученики", to: "/teacher/students" },
  { label: "Занятия", to: "/teacher/lessons" },
  { label: "Аналитика", to: "/teacher/analytics" },
  { label: "Советник", to: "/teacher/advisor" },
  { label: "Профиль", to: "/teacher/profile" },
];

export const Route = createFileRoute("/_authenticated/teacher")({
  component: () => <RoleShell title="Преподаватель" items={NAV} accent="Преподаватель" />,
});
