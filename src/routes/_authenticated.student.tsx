import { createFileRoute, useLocation } from "@tanstack/react-router";

import { RoleShell, type NavItem } from "@/components/oge/role-shell";
import { RoleGate } from "@/components/oge/role-gate";

const NAV: NavItem[] = [
  { label: "Главная", to: "/student" },
  { label: "Диагностика", to: "/student/diagnostic" },
  { label: "Предметы", to: "/student/subjects" },
  { label: "Маршрут", to: "/student/path" },
  { label: "Календарь", to: "/student/calendar" },
  { label: "Аналитика", to: "/student/analytics" },
  { label: "Ассистент", to: "/student/assistant" },
  { label: "Библиотека", to: "/student/library" },
  { label: "Профиль", to: "/student/profile" },
];

export const Route = createFileRoute("/_authenticated/student")({
  component: StudentLayout,
});

function StudentLayout() {
  const { pathname } = useLocation();
  // A linked teacher may open a student's lesson (read-only; data access is enforced by RLS).
  const isLessonView = pathname.startsWith("/student/lesson/");
  return (
    <RoleGate required="student" alsoAllow={isLessonView ? ["teacher"] : undefined}>
      <RoleShell title="Ученик" items={NAV} accent="Ученик" />
    </RoleGate>
  );
}
