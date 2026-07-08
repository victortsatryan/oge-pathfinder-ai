import { createFileRoute } from "@tanstack/react-router";

import { RoleShell, type NavItem } from "@/components/oge/role-shell";
import { RoleGate } from "@/components/oge/role-gate";

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
  component: () => (
    <RoleGate required="student">
      <RoleShell title="Ученик" items={NAV} accent="Ученик" />
    </RoleGate>
  ),
});
