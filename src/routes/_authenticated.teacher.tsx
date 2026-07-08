import { createFileRoute } from "@tanstack/react-router";

import { RoleShell, type NavItem } from "@/components/oge/role-shell";
import { RoleGate } from "@/components/oge/role-gate";

const NAV: NavItem[] = [
  { label: "Главная", to: "/teacher" },
  { label: "Ученики", to: "/teacher/students" },
  { label: "Занятия", to: "/teacher/lessons" },
  { label: "Аналитика", to: "/teacher/analytics" },
  { label: "Советник", to: "/teacher/advisor" },
  { label: "Библиотека", to: "/teacher/library" },
  { label: "Профиль", to: "/teacher/profile" },
];

export const Route = createFileRoute("/_authenticated/teacher")({
  component: () => (
    <RoleGate required="teacher">
      <RoleShell title="Преподаватель" items={NAV} accent="Преподаватель" />
    </RoleGate>
  ),
});
