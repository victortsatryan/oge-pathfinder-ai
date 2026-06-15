import { createFileRoute } from "@tanstack/react-router";

import { RoleShell, type NavItem } from "@/components/oge/role-shell";

// Унифицированная навигация преподавателя (Шаг 9):
// Главная → Ученики → Занятия → Аналитика → AI → Профиль.
// Диагностика и материалы доступны изнутри карточки ученика.
const NAV: NavItem[] = [
  { label: "Главная", to: "/teacher" },
  { label: "Ученики", to: "/teacher/students" },
  { label: "Занятия", to: "/teacher/plans" },
  { label: "Аналитика", to: "/teacher/analytics" },
  { label: "AI", to: "/teacher/assistant" },
  { label: "Профиль", to: "/profile" },
];

export const Route = createFileRoute("/_authenticated/teacher")({
  component: () => <RoleShell title="Преподаватель" items={NAV} accent="Преподаватель" />,
});
