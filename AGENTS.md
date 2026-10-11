
- Learning path regeneration never deletes lessons/attempts/results: old paths are archived, unfinished lessons become `rescheduled`, their calendar events `cancelled` — keeps student history.
- Authority comes only from `user_roles` (via `assign_self_role`/`has_role`); `profiles.role` is informational (chosen cabinet) — prevents privilege drift.
- Teacher read access to a student's lesson data goes through RLS (`is_teacher_of_student` / `can_teacher_view_lesson`) and the single `/student/lesson/$lessonId` screen in read-only mode — no separate teacher lesson screen.
