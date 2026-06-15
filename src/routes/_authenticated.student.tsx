import { createFileRoute } from "@tanstack/react-router";

import { RoleShell, type NavItem } from "@/components/oge/role-shell";

// Унифицированная навигация ученика (Шаг 9):
// Главная → Предметы → Маршрут → Календарь → Аналитика → Ассистент → Профиль.
// Остальные экраны (материалы, диагностика, отчёт, прогресс, занятия)
// доступны как вложенные сценарии из главной/предметов/тем.
const NAV: NavItem[] = [
  { label: "Главная", to: "/student" },
  { label: "Предметы", to: "/student/subjects" },
  { label: "Маршрут", to: "/student/path" },
  { label: "Календарь", to: "/student/calendar" },
  { label: "Аналитика", to: "/student/analytics" },
  { label: "Ассистент", to: "/student/assistant" },
  { label: "Профиль", to: "/profile" },
];

export const Route = createFileRoute("/_authenticated/student")({
  component: () => <RoleShell title="Ученик" items={NAV} accent="Ученик" />,
});
